-- 075_daily_number_blocks.sql
--
-- Reserved daily_number ranges per device, for offline sales.
--
-- Problem: daily_number is the ticket number the customer sees, and it is
-- assigned by create_order_atomic as MAX(daily_number)+1 under an advisory
-- lock. A device selling offline cannot compute it — two devices would both
-- pick the same number, and reassigning it at sync time would change a number
-- already printed on a customer's ticket.
--
-- Solution: while online, a device reserves a contiguous range (e.g. 51-100)
-- and consumes it locally. The numbers are correct and final from the moment
-- the ticket prints.
--
-- Trade-off: a range that is not fully consumed leaves gaps in the day's
-- numbering. That is accepted — gaps are harmless, duplicate numbers are not.

CREATE TABLE IF NOT EXISTS public.daily_number_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    day date NOT NULL,
    range_start integer NOT NULL,
    range_end integer NOT NULL,
    -- Opaque per-browser id, so a device can recover its own block after a
    -- reload instead of burning a new range every time the POS reopens.
    device_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT daily_number_blocks_pkey PRIMARY KEY (id),
    CONSTRAINT daily_number_blocks_branch_fk FOREIGN KEY (branch_id)
        REFERENCES public.branches(id) ON DELETE CASCADE,
    CONSTRAINT daily_number_blocks_range_check CHECK (range_end >= range_start),
    CONSTRAINT daily_number_blocks_size_check CHECK (range_start > 0)
);

CREATE INDEX IF NOT EXISTS idx_daily_number_blocks_branch_day
    ON public.daily_number_blocks USING btree (branch_id, day);

-- One live block per device per branch per day — reopening the POS reuses it.
CREATE UNIQUE INDEX IF NOT EXISTS daily_number_blocks_device_unique
    ON public.daily_number_blocks USING btree (branch_id, day, device_id);


-- Reserves (or returns the existing) range for one device.
--
-- Takes the same advisory lock as create_order_atomic so a reservation and a
-- concurrent online sale can never hand out the same number.
CREATE OR REPLACE FUNCTION public.reserve_daily_number_block(
    p_branch_id uuid,
    p_day date,
    p_day_start timestamptz,
    p_day_end timestamptz,
    p_size integer,
    p_device_id text
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing   record;
  v_next_start integer;
BEGIN
  IF p_size < 1 OR p_size > 500 THEN
    RAISE EXCEPTION 'Tamaño de bloque inválido: %', p_size;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_branch_id::text || p_day_start::text));

  -- Same device, same branch, same day: hand back what it already owns.
  SELECT range_start, range_end INTO v_existing
  FROM daily_number_blocks
  WHERE branch_id = p_branch_id AND day = p_day AND device_id = p_device_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'range_start', v_existing.range_start,
      'range_end', v_existing.range_end,
      'reused', true
    );
  END IF;

  -- Start past BOTH the orders already placed today and every range already
  -- reserved by another device.
  SELECT GREATEST(
    COALESCE((
      SELECT MAX(daily_number) FROM orders
      WHERE branch_id = p_branch_id
        AND created_at >= p_day_start
        AND created_at <= p_day_end
    ), 0),
    COALESCE((
      SELECT MAX(range_end) FROM daily_number_blocks
      WHERE branch_id = p_branch_id AND day = p_day
    ), 0)
  ) + 1 INTO v_next_start;

  INSERT INTO daily_number_blocks (branch_id, day, range_start, range_end, device_id)
  VALUES (p_branch_id, p_day, v_next_start, v_next_start + p_size - 1, p_device_id);

  RETURN jsonb_build_object(
    'range_start', v_next_start,
    'range_end', v_next_start + p_size - 1,
    'reused', false
  );
END;
$$;


-- create_order_atomic: accept a pre-assigned daily_number, and skip reserved
-- ranges when assigning one itself.
--
-- Only the numbering block changed; everything else is byte-identical to the
-- version in schema-base.sql.
CREATE OR REPLACE FUNCTION public.create_order_atomic(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_branch_id        uuid := (payload->>'branch_id')::uuid;
  v_cashier_id       uuid := (payload->>'cashier_id')::uuid;
  v_paid_by          uuid := NULLIF(payload->>'paid_by', '')::uuid;
  v_total            numeric := (payload->>'total')::numeric;
  v_payment_method   text := payload->>'payment_method';
  v_payment_provider text := payload->>'payment_provider';
  v_order_type       text := payload->>'order_type';
  v_table_number     text := NULLIF(payload->>'table_number', '');
  v_waiter_name      text := NULLIF(payload->>'waiter_name', '');
  v_notes            text := NULLIF(payload->>'notes', '');
  v_idempotency_key  text := NULLIF(payload->>'idempotency_key', '');
  v_day_start        timestamptz := (payload->>'day_start')::timestamptz;
  v_day_end          timestamptz := (payload->>'day_end')::timestamptz;
  -- NEW: number already reserved by an offline device, if any.
  v_given_number     integer := NULLIF(payload->>'daily_number', '')::integer;
  v_existing         record;
  v_daily_number     integer;
  v_order_id         uuid;
  v_item             jsonb;
  v_item_id          uuid;
  v_flavor           jsonb;
  v_extra            jsonb;
  v_ded              jsonb;
  v_payment          jsonb;
BEGIN
  -- Idempotencia: si la key ya fue usada, devolver la orden existente
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id, daily_number INTO v_existing
    FROM orders WHERE idempotency_key = v_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing.id,
        'daily_number', v_existing.daily_number,
        'duplicate', true
      );
    END IF;
  END IF;

  IF v_given_number IS NOT NULL THEN
    -- The device already printed this number from its reserved range; trust it
    -- and skip the lock entirely (nothing to serialize).
    v_daily_number := v_given_number;
  ELSE
    -- Serializar la numeración por sucursal+día (fix de race condition)
    PERFORM pg_advisory_xact_lock(hashtext(v_branch_id::text || (payload->>'day_start')));

    -- Jump past any range reserved for an offline device, otherwise an online
    -- sale would take a number that device has already handed to a customer.
    SELECT GREATEST(
      COALESCE((
        SELECT MAX(daily_number) FROM orders
        WHERE branch_id = v_branch_id
          AND created_at >= v_day_start
          AND created_at <= v_day_end
      ), 0),
      COALESCE((
        SELECT MAX(range_end) FROM daily_number_blocks
        WHERE branch_id = v_branch_id AND day = v_day_start::date
      ), 0)
    ) + 1 INTO v_daily_number;
  END IF;

  INSERT INTO orders (branch_id, cashier_id, paid_by, total, daily_number, payment_method, payment_provider, order_type, table_number, waiter_name, notes, idempotency_key)
  VALUES (v_branch_id, v_cashier_id, v_paid_by, v_total, v_daily_number, v_payment_method, v_payment_provider, v_order_type, v_table_number, v_waiter_name, v_notes, v_idempotency_key)
  RETURNING id INTO v_order_id;

  -- Desglose de pago mixto (opcional) — una fila por método usado
  FOR v_payment IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'payments', '[]'::jsonb)) LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (v_order_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- Items + sabores (pizzas mixtas) + extras
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO order_items (order_id, variant_id, qty, qty_physical, unit_price, discount_applied, promo_label, price_edited)
    VALUES (
      v_order_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'qty')::integer,
      (v_item->>'qty_physical')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'discount_applied')::numeric,
      v_item->>'promo_label',
      COALESCE((v_item->>'price_edited')::boolean, false)
    )
    RETURNING id INTO v_item_id;

    FOR v_flavor IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'flavors', '[]'::jsonb)) LOOP
      INSERT INTO order_item_flavors (order_item_id, variant_id, proportion)
      VALUES (v_item_id, (v_flavor->>'variant_id')::uuid, (v_flavor->>'proportion')::numeric);
    END LOOP;

    FOR v_extra IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'extras', '[]'::jsonb)) LOOP
      INSERT INTO order_item_extras (order_item_id, name, price)
      VALUES (v_item_id, v_extra->>'name', COALESCE((v_extra->>'price')::numeric, 0));
    END LOOP;
  END LOOP;

  -- Stock de ingredientes (elaboración propia) + movimientos
  FOR v_ded IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'ingredient_deductions', '[]'::jsonb)) LOOP
    UPDATE branch_stock
    SET quantity = quantity - (v_ded->>'quantity')::numeric
    WHERE branch_id = v_branch_id
      AND ingredient_id = (v_ded->>'ingredient_id')::uuid;

    INSERT INTO stock_movements (branch_id, ingredient_id, quantity, type, notes, created_by)
    VALUES (
      v_branch_id,
      (v_ded->>'ingredient_id')::uuid,
      -((v_ded->>'quantity')::numeric),
      'venta',
      'Orden ' || v_order_id,
      v_cashier_id
    );
  END LOOP;

  -- Stock de productos de reventa + movimientos
  FOR v_ded IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'resale_deductions', '[]'::jsonb)) LOOP
    UPDATE branch_product_stock
    SET quantity = quantity - (v_ded->>'quantity')::numeric,
        updated_at = now()
    WHERE branch_id = v_branch_id
      AND variant_id = (v_ded->>'variant_id')::uuid;

    INSERT INTO product_stock_movements (branch_id, variant_id, quantity, type, notes, created_by)
    VALUES (
      v_branch_id,
      (v_ded->>'variant_id')::uuid,
      -((v_ded->>'quantity')::numeric),
      'venta',
      'Orden ' || v_order_id,
      v_cashier_id
    );
  END LOOP;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'daily_number', v_daily_number,
    'duplicate', false
  );

EXCEPTION
  -- Dos requests simultáneos con la misma idempotency key: el segundo
  -- choca con el índice único → devolver la orden que ganó la carrera
  WHEN unique_violation THEN
    IF v_idempotency_key IS NOT NULL THEN
      SELECT id, daily_number INTO v_existing
      FROM orders WHERE idempotency_key = v_idempotency_key;
      IF FOUND THEN
        RETURN jsonb_build_object(
          'order_id', v_existing.id,
          'daily_number', v_existing.daily_number,
          'duplicate', true
        );
      END IF;
    END IF;
    RAISE;
END;
$$;

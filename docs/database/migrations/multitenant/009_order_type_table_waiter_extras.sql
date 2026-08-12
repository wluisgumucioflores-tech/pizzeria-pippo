-- Fase 0 del roadmap de features de la reunión (docs/meet/new-features.md):
-- soporte de datos para Mesero, mesas, Delivery propio, Pedidos Ya y extras
-- por item. Groundwork puro — todavía sin UI para crear pedidos con estos
-- campos, se habilita en las fases siguientes (Mesero, POS, impresión).

-- 1. order_type: de 2 a 4 valores (Local/Para llevar ya existían).
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check
  CHECK (order_type = ANY (ARRAY['dine_in'::text, 'takeaway'::text, 'delivery'::text, 'pedidos_ya'::text]));

-- 2. Mesa (campo libre, sin catálogo) y nombre del mesero que tomó el pedido.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waiter_name text;

-- 3. Extras por item del carrito — modificador ligado a una línea específica
-- (no es un producto del catálogo), ej. "Pizza Muzza + Extra queso".
CREATE TABLE IF NOT EXISTS public.order_item_extras (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  order_item_id uuid        NOT NULL,
  name          text        NOT NULL,
  price         numeric     NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_item_extras_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_extras_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_extras_order_item ON public.order_item_extras (order_item_id);

ALTER TABLE public.order_item_extras ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.order_item_extras TO authenticated;
GRANT ALL ON TABLE public.order_item_extras TO service_role;

CREATE POLICY "order_item_extras_select" ON public.order_item_extras FOR SELECT
  USING (order_item_id IN (
    SELECT oi.id FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));
CREATE POLICY "order_item_extras_insert" ON public.order_item_extras FOR INSERT
  WITH CHECK (order_item_id IN (
    SELECT oi.id FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));

-- 4. Redefinir create_order_atomic: agrega table_number/waiter_name a orders
-- y el insert de order_item_extras (mismo patrón que order_item_flavors).
CREATE OR REPLACE FUNCTION public.create_order_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id        uuid := (payload->>'branch_id')::uuid;
  v_cashier_id       uuid := (payload->>'cashier_id')::uuid;
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

  -- Serializar la numeración por sucursal+día (fix de race condition)
  PERFORM pg_advisory_xact_lock(hashtext(v_branch_id::text || (payload->>'day_start')));

  SELECT COALESCE(MAX(daily_number), 0) + 1 INTO v_daily_number
  FROM orders
  WHERE branch_id = v_branch_id
    AND created_at >= v_day_start
    AND created_at <= v_day_end;

  INSERT INTO orders (branch_id, cashier_id, total, daily_number, payment_method, payment_provider, order_type, table_number, waiter_name, notes, idempotency_key)
  VALUES (v_branch_id, v_cashier_id, v_total, v_daily_number, v_payment_method, v_payment_provider, v_order_type, v_table_number, v_waiter_name, v_notes, v_idempotency_key)
  RETURNING id INTO v_order_id;

  -- Desglose de pago mixto (opcional) — una fila por método usado
  FOR v_payment IN SELECT * FROM jsonb_array_elements(COALESCE(payload->'payments', '[]'::jsonb)) LOOP
    INSERT INTO order_payments (order_id, method, amount)
    VALUES (v_order_id, v_payment->>'method', (v_payment->>'amount')::numeric);
  END LOOP;

  -- Items + sabores (pizzas mixtas) + extras
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items') LOOP
    INSERT INTO order_items (order_id, variant_id, qty, qty_physical, unit_price, discount_applied, promo_label)
    VALUES (
      v_order_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'qty')::integer,
      (v_item->>'qty_physical')::integer,
      (v_item->>'unit_price')::numeric,
      (v_item->>'discount_applied')::numeric,
      v_item->>'promo_label'
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

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb) TO service_role;

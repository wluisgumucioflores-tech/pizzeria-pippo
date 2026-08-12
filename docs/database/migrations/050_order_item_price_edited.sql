-- Fase 3 del roadmap de features de la reunión (docs/meet/new-features.md):
-- editar precio al vender (cajero/admin), sobre cualquier item que NO tenga
-- promoción ni sea pizza mixta (mismo criterio que los extras de la Fase 2,
-- evita la ambigüedad de a qué línea queda atado el override si el motor de
-- promociones parte un combo). Sin motivo obligatorio — solo un flag para
-- mostrar la etiqueta "Editado" en el carrito y en Reportes.
-- NOTA: sin aplicar todavía en producción (equivalente a 048/049).

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_edited boolean NOT NULL DEFAULT false;

-- Redefinir create_order_atomic: inserta price_edited en order_items.
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

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(jsonb) TO service_role;

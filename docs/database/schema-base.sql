--
-- PostgreSQL database dump
--

\restrict hwWQxGnuv5hby1leQFVDvGeebefxDgtzMKDANTnP2ZT7ES9ngLOLq8l2m4iQdUz

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: create_order_atomic(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order_atomic(payload jsonb) RETURNS jsonb
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


--
-- Name: get_user_branch_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_branch_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: get_user_business_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_business_id() RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_chat_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_chat_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chat_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    date date NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    model_id text NOT NULL,
    label text NOT NULL,
    base_url text,
    is_local boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    api_key text
);


--
-- Name: COLUMN ai_models.api_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_models.api_key IS 'Cifrado (AES-256-GCM). Nunca se expone en texto plano vía API — ver AI_MODELS_ENCRYPTION_KEY.';


--
-- Name: ai_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    locale text NOT NULL,
    content text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    key text NOT NULL,
    value text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attendance_records_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'salida'::text])))
);


--
-- Name: branch_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT branch_prices_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: branch_product_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_product_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_quantity numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT branch_product_stock_min_quantity_check CHECK ((min_quantity >= (0)::numeric)),
    CONSTRAINT branch_product_stock_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: branch_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_quantity numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT branch_stock_min_quantity_check CHECK ((min_quantity >= (0)::numeric)),
    CONSTRAINT branch_stock_quantity_check CHECK ((quantity >= ('-99999'::integer)::numeric))
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    expected_start_time text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enabled_modules jsonb DEFAULT '{"stock": true, "aiChat": false, "mesero": false, "kitchen": true, "mcpSaas": false, "printer": true, "telegram": false, "employees": true}'::jsonb NOT NULL,
    ai_chat_plan_id uuid
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    is_pizza boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    api_key_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    full_name text NOT NULL,
    "position" text NOT NULL,
    credential_hash text NOT NULL,
    manual_code_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    unit text NOT NULL,
    is_shared_use boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ingredients_unit_check CHECK ((unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'unidad'::text])))
);


--
-- Name: mcp_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mcp_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    api_key_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_item_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_extras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    name text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_item_extras_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: order_item_flavors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_item_flavors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_item_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    proportion numeric DEFAULT 0.50 NOT NULL,
    CONSTRAINT order_item_flavors_proportion_check CHECK (((proportion > (0)::numeric) AND (proportion <= (1)::numeric)))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price numeric NOT NULL,
    discount_applied numeric DEFAULT 0 NOT NULL,
    qty_physical integer DEFAULT 1 NOT NULL,
    promo_label text,
    price_edited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_discount_applied_check CHECK ((discount_applied >= (0)::numeric)),
    CONSTRAINT order_items_qty_check CHECK ((qty > 0)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    method text NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT order_payments_method_check CHECK ((method = ANY (ARRAY['efectivo'::text, 'qr'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    total numeric NOT NULL,
    kitchen_status text DEFAULT 'pending'::text NOT NULL,
    daily_number integer DEFAULT 0 NOT NULL,
    payment_method text,
    payment_provider text,
    order_type text DEFAULT 'dine_in'::text NOT NULL,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    cancel_reason text,
    notes text,
    idempotency_key text,
    created_at timestamp with time zone DEFAULT now(),
    table_number text,
    waiter_name text,
    paid_by uuid,
    last_ready_at timestamp with time zone,
    CONSTRAINT orders_order_type_check CHECK ((order_type = ANY (ARRAY['dine_in'::text, 'takeaway'::text, 'delivery'::text, 'pedidos_ya'::text]))),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['efectivo'::text, 'qr'::text, 'online'::text, 'mixto'::text])))),
    CONSTRAINT orders_total_check CHECK ((total >= (0)::numeric))
);


--
-- Name: product_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity numeric NOT NULL,
    type text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_stock_movements_type_check CHECK ((type = ANY (ARRAY['compra'::text, 'venta'::text, 'ajuste'::text, 'anulacion'::text])))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    base_price numeric NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT product_variants_base_price_check CHECK ((base_price >= (0)::numeric))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    image_url text,
    product_type text DEFAULT 'made'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    category_id uuid,
    CONSTRAINT products_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['pizza'::text, 'bebida'::text, 'otro'::text])))),
    CONSTRAINT products_product_type_check CHECK ((product_type = ANY (ARRAY['made'::text, 'resale'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    branch_id uuid,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    full_name text,
    is_banned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_business_id_required_unless_superadmin CHECK (((role = 'superadmin'::text) OR (business_id IS NOT NULL))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text, 'superadmin'::text, 'mesero'::text])))
);


--
-- Name: promotion_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotion_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    promotion_id uuid NOT NULL,
    variant_id uuid,
    buy_qty integer,
    get_qty integer,
    discount_percent numeric,
    combo_price numeric,
    category text,
    variant_size text,
    CONSTRAINT promotion_rules_buy_qty_check CHECK ((buy_qty > 0)),
    CONSTRAINT promotion_rules_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['pizza'::text, 'bebida'::text, 'otro'::text])))),
    CONSTRAINT promotion_rules_combo_price_check CHECK ((combo_price >= (0)::numeric)),
    CONSTRAINT promotion_rules_discount_percent_check CHECK (((discount_percent > (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT promotion_rules_get_qty_check CHECK ((get_qty > 0))
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    branch_id uuid,
    name text NOT NULL,
    type text NOT NULL,
    days_of_week integer[] DEFAULT '{}'::integer[] NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT promotions_type_check CHECK ((type = ANY (ARRAY['BUY_X_GET_Y'::text, 'PERCENTAGE'::text, 'COMBO'::text])))
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    variant_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric NOT NULL,
    apply_condition text DEFAULT 'always'::text NOT NULL,
    CONSTRAINT recipes_apply_condition_check CHECK ((apply_condition = ANY (ARRAY['always'::text, 'takeaway'::text, 'dine_in'::text]))),
    CONSTRAINT recipes_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric NOT NULL,
    type text NOT NULL,
    origin text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stock_movements_origin_check CHECK ((origin = ANY (ARRAY['transferencia'::text, 'venta'::text, 'ajuste'::text]))),
    CONSTRAINT stock_movements_type_check CHECK ((type = ANY (ARRAY['compra'::text, 'venta'::text, 'ajuste'::text, 'anulacion'::text])))
);


--
-- Name: telegram_authorized_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_authorized_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id text NOT NULL,
    type text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    plan text DEFAULT 'basic'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT telegram_authorized_chats_plan_check CHECK ((plan = ANY (ARRAY['basic'::text, 'pro'::text, 'unlimited'::text]))),
    CONSTRAINT telegram_authorized_chats_type_check CHECK ((type = ANY (ARRAY['personal'::text, 'group'::text])))
);


--
-- Name: telegram_bot_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_bot_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    bot_token text NOT NULL,
    chat_id text NOT NULL,
    chat_type text DEFAULT 'group'::text NOT NULL,
    notifications_enabled boolean DEFAULT false NOT NULL,
    chat_ia_enabled boolean DEFAULT false NOT NULL,
    webhook_token text,
    webhook_secret text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: telegram_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chat_id text NOT NULL,
    date date NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: variant_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: warehouse_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric NOT NULL,
    type text NOT NULL,
    branch_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT warehouse_movements_type_check CHECK ((type = ANY (ARRAY['compra'::text, 'transferencia'::text, 'ajuste'::text])))
);


--
-- Name: warehouse_product_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_product_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity numeric NOT NULL,
    type text NOT NULL,
    branch_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT warehouse_product_movements_type_check CHECK ((type = ANY (ARRAY['compra'::text, 'transferencia'::text, 'ajuste'::text])))
);


--
-- Name: warehouse_product_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_product_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_quantity numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT warehouse_product_stock_min_quantity_check CHECK ((min_quantity >= (0)::numeric)),
    CONSTRAINT warehouse_product_stock_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: warehouse_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warehouse_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    ingredient_id uuid NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    min_quantity numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT warehouse_stock_min_quantity_check CHECK ((min_quantity >= (0)::numeric)),
    CONSTRAINT warehouse_stock_quantity_check CHECK ((quantity >= (0)::numeric))
);


--
-- Name: ai_chat_plans ai_chat_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_plans
    ADD CONSTRAINT ai_chat_plans_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_usage ai_chat_usage_business_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_usage
    ADD CONSTRAINT ai_chat_usage_business_id_date_key UNIQUE (business_id, date);


--
-- Name: ai_chat_usage ai_chat_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_usage
    ADD CONSTRAINT ai_chat_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_models ai_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_models
    ADD CONSTRAINT ai_models_pkey PRIMARY KEY (id);


--
-- Name: ai_prompts ai_prompts_locale_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_locale_key UNIQUE (locale);


--
-- Name: ai_prompts ai_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_prompts
    ADD CONSTRAINT ai_prompts_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_business_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_business_key_unique UNIQUE (business_id, key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: branch_prices branch_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_prices
    ADD CONSTRAINT branch_prices_pkey PRIMARY KEY (id);


--
-- Name: branch_product_stock branch_product_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_product_stock
    ADD CONSTRAINT branch_product_stock_pkey PRIMARY KEY (id);


--
-- Name: branch_product_stock branch_product_stock_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_product_stock
    ADD CONSTRAINT branch_product_stock_unique UNIQUE (branch_id, variant_id);


--
-- Name: branch_stock branch_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: ingredients ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_pkey PRIMARY KEY (id);


--
-- Name: mcp_api_keys mcp_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_api_keys
    ADD CONSTRAINT mcp_api_keys_pkey PRIMARY KEY (id);


--
-- Name: order_item_extras order_item_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_extras
    ADD CONSTRAINT order_item_extras_pkey PRIMARY KEY (id);


--
-- Name: order_item_flavors order_item_flavors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_flavors
    ADD CONSTRAINT order_item_flavors_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_payments order_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payments
    ADD CONSTRAINT order_payments_pkey PRIMARY KEY (id);


--
-- Name: orders orders_idempotency_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_idempotency_key_unique UNIQUE (idempotency_key);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_stock_movements product_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_movements
    ADD CONSTRAINT product_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_unique UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promotion_rules promotion_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: telegram_authorized_chats telegram_authorized_chats_chat_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_authorized_chats
    ADD CONSTRAINT telegram_authorized_chats_chat_id_unique UNIQUE (chat_id);


--
-- Name: telegram_authorized_chats telegram_authorized_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_authorized_chats
    ADD CONSTRAINT telegram_authorized_chats_pkey PRIMARY KEY (id);


--
-- Name: telegram_bot_config telegram_bot_config_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bot_config
    ADD CONSTRAINT telegram_bot_config_business_id_key UNIQUE (business_id);


--
-- Name: telegram_bot_config telegram_bot_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bot_config
    ADD CONSTRAINT telegram_bot_config_pkey PRIMARY KEY (id);


--
-- Name: telegram_bot_config telegram_bot_config_webhook_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bot_config
    ADD CONSTRAINT telegram_bot_config_webhook_token_key UNIQUE (webhook_token);


--
-- Name: telegram_usage telegram_usage_chat_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_usage
    ADD CONSTRAINT telegram_usage_chat_date_unique UNIQUE (chat_id, date);


--
-- Name: telegram_usage telegram_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_usage
    ADD CONSTRAINT telegram_usage_pkey PRIMARY KEY (id);


--
-- Name: variant_types variant_types_business_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_types
    ADD CONSTRAINT variant_types_business_name_unique UNIQUE (business_id, name);


--
-- Name: variant_types variant_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_types
    ADD CONSTRAINT variant_types_pkey PRIMARY KEY (id);


--
-- Name: warehouse_movements warehouse_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_pkey PRIMARY KEY (id);


--
-- Name: warehouse_product_movements warehouse_product_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_movements
    ADD CONSTRAINT warehouse_product_movements_pkey PRIMARY KEY (id);


--
-- Name: warehouse_product_stock warehouse_product_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_stock
    ADD CONSTRAINT warehouse_product_stock_pkey PRIMARY KEY (id);


--
-- Name: warehouse_product_stock warehouse_product_stock_variant_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_stock
    ADD CONSTRAINT warehouse_product_stock_variant_unique UNIQUE (variant_id);


--
-- Name: warehouse_stock warehouse_stock_ingredient_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT warehouse_stock_ingredient_unique UNIQUE (ingredient_id);


--
-- Name: warehouse_stock warehouse_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id);


--
-- Name: ai_chat_usage_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_chat_usage_business_id_idx ON public.ai_chat_usage USING btree (business_id);


--
-- Name: ai_models_single_default_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_models_single_default_idx ON public.ai_models USING btree (is_default) WHERE (is_default = true);


--
-- Name: attendance_records_branch_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_records_branch_created_idx ON public.attendance_records USING btree (branch_id, created_at);


--
-- Name: attendance_records_employee_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_records_employee_created_idx ON public.attendance_records USING btree (employee_id, created_at DESC);


--
-- Name: devices_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX devices_branch_id_idx ON public.devices USING btree (branch_id);


--
-- Name: employees_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employees_branch_id_idx ON public.employees USING btree (branch_id);


--
-- Name: idx_ai_chat_usage_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chat_usage_business_id ON public.ai_chat_usage USING btree (business_id);


--
-- Name: idx_categories_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_business_id ON public.categories USING btree (business_id);


--
-- Name: idx_categories_one_pizza_per_business; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_categories_one_pizza_per_business ON public.categories USING btree (business_id) WHERE is_pizza;


--
-- Name: idx_order_item_extras_order_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_item_extras_order_item ON public.order_item_extras USING btree (order_item_id);


--
-- Name: idx_order_payments_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_payments_order ON public.order_payments USING btree (order_id);


--
-- Name: idx_orders_branch_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_branch_date ON public.orders USING btree (branch_id, created_at);


--
-- Name: idx_product_stock_movements_branch_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_stock_movements_branch_variant ON public.product_stock_movements USING btree (branch_id, variant_id, created_at);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_warehouse_movements_ingredient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_movements_ingredient ON public.warehouse_movements USING btree (ingredient_id, created_at);


--
-- Name: idx_warehouse_product_movements_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warehouse_product_movements_variant ON public.warehouse_product_movements USING btree (variant_id, created_at);


--
-- Name: mcp_api_keys_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mcp_api_keys_business_id_idx ON public.mcp_api_keys USING btree (business_id);


--
-- Name: orders_cancelled_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_cancelled_at_idx ON public.orders USING btree (cancelled_at) WHERE (cancelled_at IS NULL);


--
-- Name: telegram_bot_config_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telegram_bot_config_business_id_idx ON public.telegram_bot_config USING btree (business_id);


--
-- Name: ai_chat_usage ai_chat_usage_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chat_usage
    ADD CONSTRAINT ai_chat_usage_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: app_settings app_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: attendance_records attendance_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: attendance_records attendance_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: branch_prices branch_prices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_prices
    ADD CONSTRAINT branch_prices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_prices branch_prices_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_prices
    ADD CONSTRAINT branch_prices_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: branch_product_stock branch_product_stock_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_product_stock
    ADD CONSTRAINT branch_product_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_product_stock branch_product_stock_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_product_stock
    ADD CONSTRAINT branch_product_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: branch_stock branch_stock_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_stock branch_stock_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_stock
    ADD CONSTRAINT branch_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: branches branches_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: businesses businesses_ai_chat_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_ai_chat_plan_id_fkey FOREIGN KEY (ai_chat_plan_id) REFERENCES public.ai_chat_plans(id);


--
-- Name: categories categories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: devices devices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: devices devices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: employees employees_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: employees employees_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: ingredients ingredients_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredients
    ADD CONSTRAINT ingredients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: mcp_api_keys mcp_api_keys_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mcp_api_keys
    ADD CONSTRAINT mcp_api_keys_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: order_item_extras order_item_extras_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_extras
    ADD CONSTRAINT order_item_extras_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id);


--
-- Name: order_item_flavors order_item_flavors_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_flavors
    ADD CONSTRAINT order_item_flavors_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE;


--
-- Name: order_item_flavors order_item_flavors_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_item_flavors
    ADD CONSTRAINT order_item_flavors_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: order_payments order_payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_payments
    ADD CONSTRAINT order_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: orders orders_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: orders orders_cashier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.profiles(id);


--
-- Name: orders orders_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.profiles(id);


--
-- Name: product_stock_movements product_stock_movements_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_movements
    ADD CONSTRAINT product_stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: product_stock_movements product_stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_movements
    ADD CONSTRAINT product_stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: product_stock_movements product_stock_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_stock_movements
    ADD CONSTRAINT product_stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: product_variants product_variants_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: products products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: profiles profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: profiles profiles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: promotion_rules promotion_rules_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: promotion_rules promotion_rules_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id);


--
-- Name: promotion_rules promotion_rules_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotion_rules
    ADD CONSTRAINT promotion_rules_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: promotions promotions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: promotions promotions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: recipes recipes_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: recipes recipes_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: stock_movements stock_movements_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: stock_movements stock_movements_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: telegram_bot_config telegram_bot_config_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bot_config
    ADD CONSTRAINT telegram_bot_config_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: variant_types variant_types_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_types
    ADD CONSTRAINT variant_types_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: warehouse_movements warehouse_movements_branch_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_branch_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: warehouse_movements warehouse_movements_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: warehouse_movements warehouse_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: warehouse_movements warehouse_movements_ingredient_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_movements
    ADD CONSTRAINT warehouse_movements_ingredient_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: warehouse_product_movements warehouse_product_movements_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_movements
    ADD CONSTRAINT warehouse_product_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: warehouse_product_movements warehouse_product_movements_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_movements
    ADD CONSTRAINT warehouse_product_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: warehouse_product_movements warehouse_product_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_movements
    ADD CONSTRAINT warehouse_product_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: warehouse_product_movements warehouse_product_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_movements
    ADD CONSTRAINT warehouse_product_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: warehouse_product_stock warehouse_product_stock_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_stock
    ADD CONSTRAINT warehouse_product_stock_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: warehouse_product_stock warehouse_product_stock_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_product_stock
    ADD CONSTRAINT warehouse_product_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: warehouse_stock warehouse_stock_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT warehouse_stock_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: warehouse_stock warehouse_stock_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warehouse_stock
    ADD CONSTRAINT warehouse_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id);


--
-- Name: mcp_api_keys admin_delete_mcp_api_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete_mcp_api_keys ON public.mcp_api_keys FOR DELETE TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: telegram_bot_config admin_delete_telegram_bot_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete_telegram_bot_config ON public.telegram_bot_config FOR DELETE TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: mcp_api_keys admin_insert_mcp_api_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert_mcp_api_keys ON public.mcp_api_keys FOR INSERT TO authenticated WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: telegram_bot_config admin_insert_telegram_bot_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert_telegram_bot_config ON public.telegram_bot_config FOR INSERT TO authenticated WITH CHECK ((public.get_user_role() = 'admin'::text));


--
-- Name: ai_chat_usage admin_select_ai_chat_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select_ai_chat_usage ON public.ai_chat_usage FOR SELECT TO authenticated USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));


--
-- Name: mcp_api_keys admin_select_mcp_api_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select_mcp_api_keys ON public.mcp_api_keys FOR SELECT TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: telegram_bot_config admin_select_telegram_bot_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_select_telegram_bot_config ON public.telegram_bot_config FOR SELECT TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: mcp_api_keys admin_update_mcp_api_keys; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_mcp_api_keys ON public.mcp_api_keys FOR UPDATE TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: telegram_bot_config admin_update_telegram_bot_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_telegram_bot_config ON public.telegram_bot_config FOR UPDATE TO authenticated USING ((public.get_user_role() = 'admin'::text));


--
-- Name: ai_chat_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chat_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_chat_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings app_settings_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_settings_admin_delete ON public.app_settings FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: app_settings app_settings_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_settings_admin_insert ON public.app_settings FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: app_settings app_settings_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_settings_admin_update ON public.app_settings FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: app_settings app_settings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_settings_select ON public.app_settings FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: attendance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records attendance_records_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_records_insert ON public.attendance_records FOR INSERT WITH CHECK ((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: attendance_records attendance_records_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY attendance_records_select ON public.attendance_records FOR SELECT USING ((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: ai_chat_plans authenticated_select_ai_chat_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_ai_chat_plans ON public.ai_chat_plans FOR SELECT TO authenticated USING (true);


--
-- Name: ai_models authenticated_select_ai_models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_ai_models ON public.ai_models FOR SELECT TO authenticated USING (true);


--
-- Name: ai_prompts authenticated_select_ai_prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_select_ai_prompts ON public.ai_prompts FOR SELECT TO authenticated USING (true);


--
-- Name: branch_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_prices branch_prices_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_prices_admin_delete ON public.branch_prices FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: branch_prices branch_prices_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_prices_admin_insert ON public.branch_prices FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: branch_prices branch_prices_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_prices_admin_update ON public.branch_prices FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: branch_prices branch_prices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_prices_select ON public.branch_prices FOR SELECT USING ((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: branch_product_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_product_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_product_stock branch_product_stock_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_product_stock_admin_write ON public.branch_product_stock USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: branch_product_stock branch_product_stock_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_product_stock_select ON public.branch_product_stock FOR SELECT USING (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: branch_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_stock branch_stock_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_stock_admin_write ON public.branch_stock USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: branch_stock branch_stock_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branch_stock_select ON public.branch_stock FOR SELECT USING (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_admin_delete ON public.branches FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: branches branches_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_admin_insert ON public.branches FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: branches branches_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_admin_update ON public.branches FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: branches branches_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY branches_select ON public.branches FOR SELECT USING (((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses businesses_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_select ON public.businesses FOR SELECT USING (((id = ( SELECT public.get_user_business_id() AS get_user_business_id)) OR (( SELECT public.get_user_role() AS get_user_role) = 'superadmin'::text)));


--
-- Name: devices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

--
-- Name: devices devices_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY devices_admin_all ON public.devices USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: employees employees_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY employees_admin_all ON public.employees USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: ingredients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

--
-- Name: ingredients ingredients_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ingredients_admin_delete ON public.ingredients FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: ingredients ingredients_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ingredients_admin_insert ON public.ingredients FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: ingredients ingredients_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ingredients_admin_update ON public.ingredients FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: ingredients ingredients_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ingredients_select ON public.ingredients FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: mcp_api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_extras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_extras ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_extras order_item_extras_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_extras_insert ON public.order_item_extras FOR INSERT WITH CHECK ((order_item_id IN ( SELECT oi.id
   FROM ((public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_item_extras order_item_extras_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_extras_select ON public.order_item_extras FOR SELECT USING ((order_item_id IN ( SELECT oi.id
   FROM ((public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_item_flavors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_item_flavors ENABLE ROW LEVEL SECURITY;

--
-- Name: order_item_flavors order_item_flavors_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_flavors_insert ON public.order_item_flavors FOR INSERT WITH CHECK ((order_item_id IN ( SELECT oi.id
   FROM ((public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_item_flavors order_item_flavors_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_item_flavors_select ON public.order_item_flavors FOR SELECT USING ((order_item_id IN ( SELECT oi.id
   FROM ((public.order_items oi
     JOIN public.orders o ON ((o.id = oi.order_id)))
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_insert ON public.order_items FOR INSERT WITH CHECK ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_items order_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_select ON public.order_items FOR SELECT USING ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: order_payments order_payments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_insert ON public.order_payments FOR INSERT WITH CHECK ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: order_payments order_payments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_payments_select ON public.order_payments FOR SELECT USING ((order_id IN ( SELECT o.id
   FROM (public.orders o
     JOIN public.branches b ON ((b.id = o.branch_id)))
  WHERE (b.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_admin_update ON public.orders FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: orders orders_cocinero_update_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_cocinero_update_own_branch ON public.orders FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'cocinero'::text) AND (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)) AND (branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: orders orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert ON public.orders FOR INSERT WITH CHECK (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: orders orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select ON public.orders FOR SELECT USING (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: product_stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: product_stock_movements product_stock_movements_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_stock_movements_insert ON public.product_stock_movements FOR INSERT WITH CHECK (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: product_stock_movements product_stock_movements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_stock_movements_select ON public.product_stock_movements FOR SELECT USING (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants product_variants_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_admin_delete ON public.product_variants FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: product_variants product_variants_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_admin_insert ON public.product_variants FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: product_variants product_variants_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_admin_update ON public.product_variants FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: product_variants product_variants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_select ON public.product_variants FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_admin_delete ON public.products FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: products products_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_admin_insert ON public.products FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: products products_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_admin_update ON public.products FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: products products_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select ON public.products FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_delete ON public.profiles FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: profiles profiles_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: profiles profiles_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((( SELECT public.get_user_role() AS get_user_role) = 'superadmin'::text) OR ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)) AND ((id = auth.uid()) OR (( SELECT public.get_user_role() AS get_user_role) = 'admin'::text)))));


--
-- Name: promotion_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: promotion_rules promotion_rules_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_admin_delete ON public.promotion_rules FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotion_rules promotion_rules_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_admin_insert ON public.promotion_rules FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotion_rules promotion_rules_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_admin_update ON public.promotion_rules FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotion_rules promotion_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotion_rules_select ON public.promotion_rules FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions promotions_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_admin_delete ON public.promotions FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotions promotions_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_admin_insert ON public.promotions FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotions promotions_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_admin_update ON public.promotions FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: promotions promotions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY promotions_select ON public.promotions FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: recipes recipes_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_admin_delete ON public.recipes FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (variant_id IN ( SELECT product_variants.id
   FROM public.product_variants
  WHERE (product_variants.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: recipes recipes_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_admin_insert ON public.recipes FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (variant_id IN ( SELECT product_variants.id
   FROM public.product_variants
  WHERE (product_variants.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: recipes recipes_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_admin_update ON public.recipes FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (variant_id IN ( SELECT product_variants.id
   FROM public.product_variants
  WHERE (product_variants.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))))));


--
-- Name: recipes recipes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recipes_select ON public.recipes FOR SELECT USING ((variant_id IN ( SELECT product_variants.id
   FROM public.product_variants
  WHERE (product_variants.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))));


--
-- Name: stock_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_movements stock_movements_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movements_insert ON public.stock_movements FOR INSERT WITH CHECK (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: stock_movements stock_movements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stock_movements_select ON public.stock_movements FOR SELECT USING (((branch_id IN ( SELECT branches.id
   FROM public.branches
  WHERE (branches.business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) AND ((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) OR (branch_id = ( SELECT public.get_user_branch_id() AS get_user_branch_id)))));


--
-- Name: ai_chat_plans superadmin_insert_ai_chat_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_insert_ai_chat_plans ON public.ai_chat_plans FOR INSERT TO authenticated WITH CHECK ((public.get_user_role() = 'superadmin'::text));


--
-- Name: ai_chat_plans superadmin_update_ai_chat_plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_update_ai_chat_plans ON public.ai_chat_plans FOR UPDATE TO authenticated USING ((public.get_user_role() = 'superadmin'::text));


--
-- Name: telegram_bot_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;

--
-- Name: variant_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.variant_types ENABLE ROW LEVEL SECURITY;

--
-- Name: variant_types variant_types_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variant_types_admin_delete ON public.variant_types FOR DELETE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: variant_types variant_types_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variant_types_admin_insert ON public.variant_types FOR INSERT WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: variant_types variant_types_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variant_types_admin_update ON public.variant_types FOR UPDATE USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: variant_types variant_types_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variant_types_select ON public.variant_types FOR SELECT USING ((business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)));


--
-- Name: warehouse_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_movements warehouse_movements_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_movements_admin_all ON public.warehouse_movements USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: warehouse_product_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_product_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_product_movements warehouse_product_movements_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_product_movements_admin_all ON public.warehouse_product_movements USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: warehouse_product_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_product_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_product_stock warehouse_product_stock_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_product_stock_admin_all ON public.warehouse_product_stock USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: warehouse_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: warehouse_stock warehouse_stock_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warehouse_stock_admin_all ON public.warehouse_stock USING (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id)))) WITH CHECK (((( SELECT public.get_user_role() AS get_user_role) = 'admin'::text) AND (business_id = ( SELECT public.get_user_business_id() AS get_user_business_id))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;


--
-- Name: FUNCTION create_order_atomic(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_order_atomic(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_order_atomic(payload jsonb) TO service_role;


--
-- Name: FUNCTION get_user_branch_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_branch_id() TO anon;
GRANT ALL ON FUNCTION public.get_user_branch_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_branch_id() TO service_role;


--
-- Name: FUNCTION get_user_business_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_business_id() TO anon;
GRANT ALL ON FUNCTION public.get_user_business_id() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_business_id() TO service_role;


--
-- Name: FUNCTION get_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_role() TO anon;
GRANT ALL ON FUNCTION public.get_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role() TO service_role;


--
-- Name: TABLE ai_chat_plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_chat_plans TO anon;
GRANT ALL ON TABLE public.ai_chat_plans TO authenticated;
GRANT ALL ON TABLE public.ai_chat_plans TO service_role;


--
-- Name: TABLE ai_chat_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_chat_usage TO anon;
GRANT ALL ON TABLE public.ai_chat_usage TO authenticated;
GRANT ALL ON TABLE public.ai_chat_usage TO service_role;


--
-- Name: TABLE ai_models; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_models TO anon;
GRANT ALL ON TABLE public.ai_models TO authenticated;
GRANT ALL ON TABLE public.ai_models TO service_role;


--
-- Name: TABLE ai_prompts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_prompts TO anon;
GRANT ALL ON TABLE public.ai_prompts TO authenticated;
GRANT ALL ON TABLE public.ai_prompts TO service_role;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


--
-- Name: TABLE attendance_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attendance_records TO anon;
GRANT ALL ON TABLE public.attendance_records TO authenticated;
GRANT ALL ON TABLE public.attendance_records TO service_role;


--
-- Name: TABLE branch_prices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.branch_prices TO anon;
GRANT ALL ON TABLE public.branch_prices TO authenticated;
GRANT ALL ON TABLE public.branch_prices TO service_role;


--
-- Name: TABLE branch_product_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.branch_product_stock TO anon;
GRANT ALL ON TABLE public.branch_product_stock TO authenticated;
GRANT ALL ON TABLE public.branch_product_stock TO service_role;


--
-- Name: TABLE branch_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.branch_stock TO anon;
GRANT ALL ON TABLE public.branch_stock TO authenticated;
GRANT ALL ON TABLE public.branch_stock TO service_role;


--
-- Name: TABLE branches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.branches TO anon;
GRANT ALL ON TABLE public.branches TO authenticated;
GRANT ALL ON TABLE public.branches TO service_role;


--
-- Name: TABLE businesses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.businesses TO anon;
GRANT ALL ON TABLE public.businesses TO authenticated;
GRANT ALL ON TABLE public.businesses TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE devices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.devices TO anon;
GRANT ALL ON TABLE public.devices TO authenticated;
GRANT ALL ON TABLE public.devices TO service_role;


--
-- Name: TABLE employees; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.employees TO anon;
GRANT ALL ON TABLE public.employees TO authenticated;
GRANT ALL ON TABLE public.employees TO service_role;


--
-- Name: TABLE ingredients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ingredients TO anon;
GRANT ALL ON TABLE public.ingredients TO authenticated;
GRANT ALL ON TABLE public.ingredients TO service_role;


--
-- Name: TABLE mcp_api_keys; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mcp_api_keys TO anon;
GRANT ALL ON TABLE public.mcp_api_keys TO authenticated;
GRANT ALL ON TABLE public.mcp_api_keys TO service_role;


--
-- Name: TABLE order_item_extras; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_item_extras TO anon;
GRANT ALL ON TABLE public.order_item_extras TO authenticated;
GRANT ALL ON TABLE public.order_item_extras TO service_role;


--
-- Name: TABLE order_item_flavors; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_item_flavors TO anon;
GRANT ALL ON TABLE public.order_item_flavors TO authenticated;
GRANT ALL ON TABLE public.order_item_flavors TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: TABLE order_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_payments TO anon;
GRANT ALL ON TABLE public.order_payments TO authenticated;
GRANT ALL ON TABLE public.order_payments TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: TABLE product_stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_stock_movements TO anon;
GRANT ALL ON TABLE public.product_stock_movements TO authenticated;
GRANT ALL ON TABLE public.product_stock_movements TO service_role;


--
-- Name: TABLE product_variants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_variants TO anon;
GRANT ALL ON TABLE public.product_variants TO authenticated;
GRANT ALL ON TABLE public.product_variants TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE promotion_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotion_rules TO anon;
GRANT ALL ON TABLE public.promotion_rules TO authenticated;
GRANT ALL ON TABLE public.promotion_rules TO service_role;


--
-- Name: TABLE promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotions TO anon;
GRANT ALL ON TABLE public.promotions TO authenticated;
GRANT ALL ON TABLE public.promotions TO service_role;


--
-- Name: TABLE recipes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.recipes TO anon;
GRANT ALL ON TABLE public.recipes TO authenticated;
GRANT ALL ON TABLE public.recipes TO service_role;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stock_movements TO anon;
GRANT ALL ON TABLE public.stock_movements TO authenticated;
GRANT ALL ON TABLE public.stock_movements TO service_role;


--
-- Name: TABLE telegram_authorized_chats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_authorized_chats TO anon;
GRANT ALL ON TABLE public.telegram_authorized_chats TO authenticated;
GRANT ALL ON TABLE public.telegram_authorized_chats TO service_role;


--
-- Name: TABLE telegram_bot_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_bot_config TO anon;
GRANT ALL ON TABLE public.telegram_bot_config TO authenticated;
GRANT ALL ON TABLE public.telegram_bot_config TO service_role;


--
-- Name: TABLE telegram_usage; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.telegram_usage TO anon;
GRANT ALL ON TABLE public.telegram_usage TO authenticated;
GRANT ALL ON TABLE public.telegram_usage TO service_role;


--
-- Name: TABLE variant_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.variant_types TO anon;
GRANT ALL ON TABLE public.variant_types TO authenticated;
GRANT ALL ON TABLE public.variant_types TO service_role;


--
-- Name: TABLE warehouse_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse_movements TO anon;
GRANT ALL ON TABLE public.warehouse_movements TO authenticated;
GRANT ALL ON TABLE public.warehouse_movements TO service_role;


--
-- Name: TABLE warehouse_product_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse_product_movements TO anon;
GRANT ALL ON TABLE public.warehouse_product_movements TO authenticated;
GRANT ALL ON TABLE public.warehouse_product_movements TO service_role;


--
-- Name: TABLE warehouse_product_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse_product_stock TO anon;
GRANT ALL ON TABLE public.warehouse_product_stock TO authenticated;
GRANT ALL ON TABLE public.warehouse_product_stock TO service_role;


--
-- Name: TABLE warehouse_stock; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.warehouse_stock TO anon;
GRANT ALL ON TABLE public.warehouse_stock TO authenticated;
GRANT ALL ON TABLE public.warehouse_stock TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict hwWQxGnuv5hby1leQFVDvGeebefxDgtzMKDANTnP2ZT7ES9ngLOLq8l2m4iQdUz


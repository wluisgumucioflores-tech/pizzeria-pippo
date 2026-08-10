-- ============================================================
-- 001_initial_schema_multitenant.sql
--
-- Schema inicial para el Supabase de DESARROLLO, pensado para
-- multitenant desde el día 1: cada tabla que lo necesita nace
-- con `business_id NOT NULL` en vez de agregarlo incremental
-- como se hace en producción (ver docs/plans/2026-06-09-multitenant-f0-f1-foundations.md
-- para el enfoque incremental que SÍ aplica a producción).
--
-- Correr después de 000_reset_dev_database.sql, en el SQL Editor
-- de Supabase (proyecto dev).
--
-- Alcance F0: estructura + RLS base. NO incluye todavía:
--   - Columnas de negocio para F3 (slug, logo, plan, límites)
--   - `create_order_atomic` (reaplicar 047_orders_notes.sql aparte)
--   - Scoping en el backend NestJS (F1, sigue pendiente)
-- ============================================================

-- ============================================================
-- PARTE 1 — Negocio, sucursales, usuarios, configuración
-- ============================================================

CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  expected_start_time text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id),
  CONSTRAINT branches_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  branch_id uuid,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin', 'cajero', 'cocinero'])),
  full_name text,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT profiles_email_unique UNIQUE (email)
);

CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id),
  CONSTRAINT app_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT app_settings_business_key_unique UNIQUE (business_id, key)
);

-- ============================================================
-- PARTE 2 — Catálogo (productos, variantes, insumos)
-- ============================================================

CREATE TABLE public.variant_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT variant_types_pkey PRIMARY KEY (id),
  CONSTRAINT variant_types_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT variant_types_business_name_unique UNIQUE (business_id, name)
);

CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  unit text NOT NULL CHECK (unit = ANY (ARRAY['g', 'kg', 'ml', 'l', 'unidad'])),
  is_shared_use boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredients_pkey PRIMARY KEY (id),
  CONSTRAINT ingredients_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['pizza', 'bebida', 'otro'])),
  description text,
  image_url text,
  product_type text NOT NULL DEFAULT 'made',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  name text NOT NULL,
  base_price numeric NOT NULL CHECK (base_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

-- Resuelve business_id vía join a branches — no necesita columna propia
CREATE TABLE public.branch_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_prices_pkey PRIMARY KEY (id),
  CONSTRAINT branch_prices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_prices_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

-- Resuelve business_id vía join a product_variants — no necesita columna propia
CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  apply_condition text NOT NULL DEFAULT 'always' CHECK (apply_condition = ANY (ARRAY['always', 'takeaway', 'dine_in'])),
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);

-- ============================================================
-- PARTE 3 — Personal y dispositivos
-- ============================================================

CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  full_name text NOT NULL,
  position text NOT NULL,
  credential_hash text NOT NULL,
  manual_code_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT employees_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

-- Resuelve business_id vía join a branches — no necesita columna propia
CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT attendance_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  name text NOT NULL,
  api_key_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT devices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

-- ============================================================
-- PARTE 4 — Stock por sucursal
-- Todas resuelven business_id vía join a branches — no tienen columna propia
-- ============================================================

CREATE TABLE public.branch_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);

CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['compra', 'venta', 'ajuste', 'anulacion'])),
  origin text CHECK (origin = ANY (ARRAY['transferencia', 'venta', 'ajuste'])),
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT stock_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.branch_product_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT branch_product_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_product_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_product_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT branch_product_stock_unique UNIQUE (branch_id, variant_id)
);

CREATE TABLE public.product_stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT product_stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT product_stock_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT product_stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- ============================================================
-- PARTE 5 — Almacén central (no es por sucursal, sí por negocio)
-- ============================================================

CREATE TABLE public.warehouse_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_stock_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT warehouse_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT warehouse_stock_ingredient_unique UNIQUE (ingredient_id)
);

CREATE TABLE public.warehouse_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['compra', 'transferencia', 'ajuste'])),
  branch_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouse_movements_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT warehouse_movements_ingredient_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT warehouse_movements_branch_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT warehouse_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.warehouse_product_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  min_quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_product_stock_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_product_stock_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT warehouse_product_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT warehouse_product_stock_variant_unique UNIQUE (variant_id)
);

CREATE TABLE public.warehouse_product_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL,
  branch_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_product_movements_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_product_movements_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT warehouse_product_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT warehouse_product_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT warehouse_product_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- ============================================================
-- PARTE 6 — Promociones
-- ============================================================

CREATE TABLE public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  branch_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['BUY_X_GET_Y', 'PERCENTAGE', 'COMBO'])),
  days_of_week integer[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT promotions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

CREATE TABLE public.promotion_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  promotion_id uuid NOT NULL,
  variant_id uuid,
  buy_qty integer CHECK (buy_qty > 0),
  get_qty integer CHECK (get_qty > 0),
  discount_percent numeric CHECK (discount_percent > 0 AND discount_percent <= 100),
  combo_price numeric CHECK (combo_price >= 0),
  category text CHECK (category IS NULL OR category = ANY (ARRAY['pizza', 'bebida', 'otro'])),
  variant_size text CHECK (variant_size IS NULL OR variant_size = ANY (ARRAY['Personal', 'Mediana', 'Familiar'])),
  CONSTRAINT promotion_rules_pkey PRIMARY KEY (id),
  CONSTRAINT promotion_rules_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id),
  CONSTRAINT promotion_rules_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

-- ============================================================
-- PARTE 7 — Órdenes
-- Todas resuelven business_id vía join a branches — no tienen columna propia
-- ============================================================

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  total numeric NOT NULL CHECK (total >= 0),
  kitchen_status text NOT NULL DEFAULT 'pending',
  daily_number integer NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method = ANY (ARRAY['efectivo', 'qr'])),
  payment_provider text,
  order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type = ANY (ARRAY['dine_in', 'takeaway'])),
  cancelled_at timestamp with time zone,
  cancelled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancel_reason text,
  notes text,
  idempotency_key text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT orders_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.profiles(id),
  CONSTRAINT orders_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX idx_orders_branch_date ON public.orders (branch_id, created_at);

CREATE TABLE public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  method text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_payments_pkey PRIMARY KEY (id),
  CONSTRAINT order_payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  discount_applied numeric NOT NULL DEFAULT 0 CHECK (discount_applied >= 0),
  qty_physical integer NOT NULL DEFAULT 1,
  promo_label text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

-- Pizzas mixtas (mitad/mitad): dos filas con proportion = 0.50
CREATE TABLE public.order_item_flavors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  proportion numeric NOT NULL DEFAULT 0.50 CHECK (proportion > 0 AND proportion <= 1),
  CONSTRAINT order_item_flavors_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_flavors_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE,
  CONSTRAINT order_item_flavors_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

-- ============================================================
-- PARTE 8 — Telegram (global, sin business_id)
-- Bot Telegram multitenant queda fuera de alcance (ver docs/features/20-multitenant.md,
-- "No incluye"). El webhook hoy resuelve settings del primer negocio
-- (getRawSettingsForFirstBusiness) — estas tablas siguen sin scoping.
-- ============================================================

CREATE TABLE public.telegram_authorized_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  type text NOT NULL,
  label text NOT NULL DEFAULT '',
  plan text NOT NULL DEFAULT 'basic',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT telegram_authorized_chats_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_authorized_chats_chat_id_unique UNIQUE (chat_id)
);

CREATE TABLE public.telegram_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT telegram_usage_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_usage_chat_date_unique UNIQUE (chat_id, date)
);

-- ============================================================
-- PARTE 9 — Funciones helper para RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT business_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- PARTE 10 — Row Level Security
--
-- Base razonable para F0, no 1:1 con la granularidad de producción
-- (que fue creciendo en docs/database/migrations/001-047). El punto
-- clave que corrige respecto a producción hoy: NINGUNA policy usa
-- `using (true)` — el equivalente de "lectura pública" pasa a ser
-- "lectura dentro del mismo negocio" en todas las tablas.
-- ============================================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_product_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_product_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_flavors ENABLE ROW LEVEL SECURITY;

-- businesses: cada usuario ve solo su propio negocio.
-- Alta/edición de negocios (superadmin) todavía no tiene rol propio en
-- profiles.role — se hace vía service role desde el backend hasta F3.
CREATE POLICY "businesses_select_own" ON public.businesses FOR SELECT
  USING (id = (SELECT public.get_user_business_id()));

-- branches: dentro del negocio, admin ve todas, cajero/cocinero solo la suya
CREATE POLICY "branches_select" ON public.branches FOR SELECT
  USING (
    business_id = (SELECT public.get_user_business_id())
    AND ((SELECT public.get_user_role()) = 'admin' OR id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "branches_admin_insert" ON public.branches FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "branches_admin_update" ON public.branches FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "branches_admin_delete" ON public.branches FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- profiles: cada usuario ve su propio perfil; admin ve todos los de su negocio
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    business_id = (SELECT public.get_user_business_id())
    AND (id = auth.uid() OR (SELECT public.get_user_role()) = 'admin')
  );
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- app_settings: cualquier autenticado del negocio lee, solo admin escribe
CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "app_settings_admin_insert" ON public.app_settings FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "app_settings_admin_update" ON public.app_settings FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "app_settings_admin_delete" ON public.app_settings FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- Catálogo (variant_types, ingredients, products, product_variants):
-- lectura para cualquier autenticado del negocio (display/POS lo necesitan), escritura solo admin
CREATE POLICY "variant_types_select" ON public.variant_types FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "variant_types_admin_insert" ON public.variant_types FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "variant_types_admin_update" ON public.variant_types FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "variant_types_admin_delete" ON public.variant_types FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "ingredients_select" ON public.ingredients FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "ingredients_admin_insert" ON public.ingredients FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "ingredients_admin_update" ON public.ingredients FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "ingredients_admin_delete" ON public.ingredients FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "products_select" ON public.products FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "products_admin_insert" ON public.products FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "products_admin_update" ON public.products FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "products_admin_delete" ON public.products FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "product_variants_select" ON public.product_variants FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "product_variants_admin_insert" ON public.product_variants FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "product_variants_admin_update" ON public.product_variants FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "product_variants_admin_delete" ON public.product_variants FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- branch_prices: sin columna propia — resuelve negocio vía branch_id
CREATE POLICY "branch_prices_select" ON public.branch_prices FOR SELECT
  USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));
CREATE POLICY "branch_prices_admin_insert" ON public.branch_prices FOR INSERT
  WITH CHECK (
    (SELECT public.get_user_role()) = 'admin'
    AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
  );
CREATE POLICY "branch_prices_admin_update" ON public.branch_prices FOR UPDATE
  USING (
    (SELECT public.get_user_role()) = 'admin'
    AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
  );
CREATE POLICY "branch_prices_admin_delete" ON public.branch_prices FOR DELETE
  USING (
    (SELECT public.get_user_role()) = 'admin'
    AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
  );

-- recipes: sin columna propia — resuelve negocio vía variant_id
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT
  USING (variant_id IN (SELECT id FROM public.product_variants WHERE business_id = (SELECT public.get_user_business_id())));
CREATE POLICY "recipes_admin_insert" ON public.recipes FOR INSERT
  WITH CHECK (
    (SELECT public.get_user_role()) = 'admin'
    AND variant_id IN (SELECT id FROM public.product_variants WHERE business_id = (SELECT public.get_user_business_id()))
  );
CREATE POLICY "recipes_admin_update" ON public.recipes FOR UPDATE
  USING (
    (SELECT public.get_user_role()) = 'admin'
    AND variant_id IN (SELECT id FROM public.product_variants WHERE business_id = (SELECT public.get_user_business_id()))
  );
CREATE POLICY "recipes_admin_delete" ON public.recipes FOR DELETE
  USING (
    (SELECT public.get_user_role()) = 'admin'
    AND variant_id IN (SELECT id FROM public.product_variants WHERE business_id = (SELECT public.get_user_business_id()))
  );

-- employees, attendance_records, devices: admin del negocio
CREATE POLICY "employees_admin_all" ON public.employees FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "attendance_records_select" ON public.attendance_records FOR SELECT
  USING (branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));
CREATE POLICY "attendance_records_insert" ON public.attendance_records FOR INSERT
  WITH CHECK (branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));

CREATE POLICY "devices_admin_all" ON public.devices FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- Stock por sucursal: admin ve todo su negocio, cajero/cocinero solo su sucursal
CREATE POLICY "branch_stock_select" ON public.branch_stock FOR SELECT
  USING (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "branch_stock_admin_write" ON public.branch_stock FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));

CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT
  USING (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT
  WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );

CREATE POLICY "branch_product_stock_select" ON public.branch_product_stock FOR SELECT
  USING (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "branch_product_stock_admin_write" ON public.branch_product_stock FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));

CREATE POLICY "product_stock_movements_select" ON public.product_stock_movements FOR SELECT
  USING (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "product_stock_movements_insert" ON public.product_stock_movements FOR INSERT
  WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );

-- Almacén central: solo admin del negocio (igual que producción hoy — la bodega no es por sucursal)
CREATE POLICY "warehouse_stock_admin_all" ON public.warehouse_stock FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "warehouse_movements_admin_all" ON public.warehouse_movements FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "warehouse_product_stock_admin_all" ON public.warehouse_product_stock FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "warehouse_product_movements_admin_all" ON public.warehouse_product_movements FOR ALL
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()))
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- Promociones: lectura para cualquier autenticado del negocio (POS las necesita), escritura solo admin
CREATE POLICY "promotions_select" ON public.promotions FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotions_admin_insert" ON public.promotions FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotions_admin_update" ON public.promotions FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotions_admin_delete" ON public.promotions FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

CREATE POLICY "promotion_rules_select" ON public.promotion_rules FOR SELECT
  USING (business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotion_rules_admin_insert" ON public.promotion_rules FOR INSERT
  WITH CHECK ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotion_rules_admin_update" ON public.promotion_rules FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));
CREATE POLICY "promotion_rules_admin_delete" ON public.promotion_rules FOR DELETE
  USING ((SELECT public.get_user_role()) = 'admin' AND business_id = (SELECT public.get_user_business_id()));

-- Órdenes: admin ve todo su negocio, cajero/cocinero solo su sucursal
CREATE POLICY "orders_select" ON public.orders FOR SELECT
  USING (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "orders_insert" ON public.orders FOR INSERT
  WITH CHECK (
    branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
    AND ((SELECT public.get_user_role()) = 'admin' OR branch_id = (SELECT public.get_user_branch_id()))
  );
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE
  USING ((SELECT public.get_user_role()) = 'admin' AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id())));
CREATE POLICY "orders_cocinero_update_own_branch" ON public.orders FOR UPDATE
  USING (
    (SELECT public.get_user_role()) = 'cocinero'
    AND branch_id = (SELECT public.get_user_branch_id())
    AND branch_id IN (SELECT id FROM public.branches WHERE business_id = (SELECT public.get_user_business_id()))
  );

CREATE POLICY "order_payments_select" ON public.order_payments FOR SELECT
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));
CREATE POLICY "order_payments_insert" ON public.order_payments FOR INSERT
  WITH CHECK (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT
  WITH CHECK (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));

CREATE POLICY "order_item_flavors_select" ON public.order_item_flavors FOR SELECT
  USING (order_item_id IN (
    SELECT oi.id FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));
CREATE POLICY "order_item_flavors_insert" ON public.order_item_flavors FOR INSERT
  WITH CHECK (order_item_id IN (
    SELECT oi.id FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.branches b ON b.id = o.branch_id
    WHERE b.business_id = (SELECT public.get_user_business_id())
  ));

-- telegram_authorized_chats / telegram_usage: sin RLS por negocio a propósito.
-- Son globales hoy (bot Telegram multitenant está fuera de alcance del MVP,
-- ver docs/features/20-multitenant.md). Acceso solo vía backend (service role).

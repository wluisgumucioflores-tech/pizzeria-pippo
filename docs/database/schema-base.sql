-- ============================================================
-- schema-base.sql
-- Schema real de la base de datos — Pizzería Pippo
-- Exportado desde Supabase. Solo para referencia/contexto.
-- NO ejecutar directamente (el orden y las FK pueden no ser válidos).
-- Para aplicar cambios usar los archivos en migrations/
--
-- Última migración aplicada: 017_stock_movements_add_anulacion_type.sql
-- (parcialmente desactualizado más allá de esto — ver docs/database/migrations/
-- para el historial completo; se agregaron acá `businesses`/`app_settings`/
-- `profiles.business_id` puntualmente por la migración 034, y
-- `profiles.email`/`password_hash`/`is_banned` + drop de FKs a `auth.users`
-- por las migraciones 035-037 (Fase 7, NestJS ahora es dueño de Auth),
-- y `devices` por la migración 038 (validación automática de pago QR),
-- sin resincronizar el resto del archivo)
-- ============================================================

CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT branches_pkey PRIMARY KEY (id)
);

CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  name text NOT NULL,
  api_key_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

CREATE TABLE public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  enabled_modules jsonb NOT NULL DEFAULT '{"kitchen":true,"stock":true,"employees":true,"telegram":false,"printer":true,"mesero":false}'::jsonb,
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text])),
  branch_id uuid,
  full_name text,
  created_at timestamp with time zone DEFAULT now(),
  business_id uuid,
  email text NOT NULL,
  password_hash text NOT NULL,
  is_banned boolean NOT NULL DEFAULT false,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id),
  CONSTRAINT profiles_email_unique UNIQUE (email)
);

CREATE TABLE public.app_settings (
  key text NOT NULL,
  value text NOT NULL DEFAULT ''::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  business_id uuid,
  CONSTRAINT app_settings_business_key_unique UNIQUE (business_id, key),
  CONSTRAINT app_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['pizza'::text, 'bebida'::text, 'otro'::text])),
  description text,
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.variant_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT variant_types_pkey PRIMARY KEY (id),
  CONSTRAINT variant_types_name_unique UNIQUE (name)
);

CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  name text NOT NULL,
  base_price numeric NOT NULL CHECK (base_price >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT product_variants_pkey PRIMARY KEY (id),
  CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);

CREATE TABLE public.branch_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_prices_pkey PRIMARY KEY (id),
  CONSTRAINT branch_prices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_prices_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text NOT NULL CHECK (unit = ANY (ARRAY['g'::text, 'kg'::text, 'ml'::text, 'l'::text, 'unidad'::text])),
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT ingredients_pkey PRIMARY KEY (id)
);

CREATE TABLE public.branch_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0::numeric),
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0::numeric),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_stock_pkey PRIMARY KEY (id),
  CONSTRAINT branch_stock_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);

CREATE TABLE public.recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0::numeric),
  apply_condition text NOT NULL DEFAULT 'always' CHECK (apply_condition = ANY (ARRAY['always'::text, 'takeaway'::text, 'dine_in'::text])),
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id),
  CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);

CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['compra'::text, 'venta'::text, 'ajuste'::text, 'anulacion'::text])),
  origin text CHECK (origin = ANY (ARRAY['transferencia'::text, 'venta'::text, 'ajuste'::text])),
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
  CONSTRAINT stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT stock_movements_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['BUY_X_GET_Y'::text, 'PERCENTAGE'::text, 'COMBO'::text])),
  days_of_week integer[] NOT NULL DEFAULT '{}',
  start_date date NOT NULL,
  end_date date NOT NULL,
  branch_id uuid,
  -- Nota: existen dos columnas de estado por migración incremental.
  -- `active` es la original; `is_active` fue agregada para consistencia con el resto del sistema.
  -- El código usa `active` para leer/escribir. `is_active` puede usarse indistintamente.
  active boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT promotions_pkey PRIMARY KEY (id),
  CONSTRAINT promotions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);

CREATE TABLE public.promotion_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL,
  variant_id uuid,
  buy_qty integer CHECK (buy_qty > 0),
  get_qty integer CHECK (get_qty > 0),
  discount_percent numeric CHECK (discount_percent > 0::numeric AND discount_percent <= 100::numeric),
  combo_price numeric CHECK (combo_price >= 0::numeric),
  -- Campos para combos flexibles (migración 014): si category/variant_size están presentes,
  -- el slot matchea cualquier variante que cumpla ambos criterios (variant_id debe ser NULL).
  category text CHECK (category IS NULL OR category = ANY (ARRAY['pizza', 'bebida', 'otro'])),
  variant_size text CHECK (variant_size IS NULL OR variant_size = ANY (ARRAY['Personal', 'Mediana', 'Familiar'])),
  CONSTRAINT promotion_rules_pkey PRIMARY KEY (id),
  CONSTRAINT promotion_rules_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id),
  CONSTRAINT promotion_rules_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  cashier_id uuid NOT NULL,
  total numeric NOT NULL CHECK (total >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  kitchen_status character varying DEFAULT 'pending'::character varying,
  daily_number integer NOT NULL DEFAULT 0,
  payment_method text CHECK (payment_method = ANY (ARRAY['efectivo'::text, 'qr'::text])),
  order_type text NOT NULL DEFAULT 'dine_in' CHECK (order_type = ANY (ARRAY['dine_in'::text, 'takeaway'::text])),
  cancelled_at timestamptz DEFAULT NULL,
  cancelled_by uuid DEFAULT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancel_reason text DEFAULT NULL,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT orders_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.profiles(id)
);

CREATE INDEX idx_orders_branch_date ON public.orders (branch_id, created_at);

CREATE TABLE public.warehouse_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity numeric NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_stock_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT warehouse_stock_ingredient_unique UNIQUE (ingredient_id)
);

CREATE TABLE public.warehouse_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['compra'::text, 'transferencia'::text, 'ajuste'::text])),
  branch_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouse_movements_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_movements_ingredient_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id),
  CONSTRAINT warehouse_movements_branch_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT warehouse_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE INDEX idx_warehouse_movements_ingredient ON public.warehouse_movements (ingredient_id, created_at);

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  discount_applied numeric NOT NULL DEFAULT 0 CHECK (discount_applied >= 0::numeric),
  qty_physical integer NOT NULL DEFAULT 1,
  promo_label text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

-- Tabla satélite para pizzas mixtas (mitad/mitad).
-- Solo existe cuando el ítem es una pizza con dos sabores.
-- Cada pizza mixta genera dos filas con proportion = 0.50.
CREATE TABLE public.order_item_flavors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  proportion numeric NOT NULL DEFAULT 0.50 CHECK (proportion > 0 AND proportion <= 1),
  CONSTRAINT order_item_flavors_pkey PRIMARY KEY (id),
  CONSTRAINT order_item_flavors_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id) ON DELETE CASCADE,
  CONSTRAINT order_item_flavors_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
);

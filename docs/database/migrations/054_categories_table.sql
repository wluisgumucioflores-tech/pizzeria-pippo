-- Categorías configurables por negocio (módulo opcional "categories").
-- Aditivo: no toca la columna products.category ni su CHECK constraint —
-- los negocios sin el módulo activo siguen usando el texto hardcodeado.
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  name text NOT NULL,
  is_pizza boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_business_id ON categories(business_id);
-- Como máximo una categoría "es de pizza" por negocio, para que la búsqueda sea inambigua.
CREATE UNIQUE INDEX idx_categories_one_pizza_per_business ON categories(business_id) WHERE is_pizza;

ALTER TABLE products ADD COLUMN category_id uuid REFERENCES categories(id);
CREATE INDEX idx_products_category_id ON products(category_id);

-- ============================================================
-- 072_product_deduct_stock_on_sale.sql
--
-- Per-product inventory control (see docs/features/jefe-produccion/
-- feature.md, "Control de inventario" section): one field, uniform for
-- resale and made products.
--
-- - Resale: default true, no behavior change (already deducted branch
--   stock on sale).
-- - Made: default true at the column level, but reset to false for all
--   EXISTING 'made' products (below) — current behavior (ingredient
--   recipe, no unit stock) doesn't change for anyone until an admin turns
--   it on by hand for a specific product. Only takes real effect if the
--   business has the 'produccion' module enabled (enforced in
--   products.service.ts).
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deduct_stock_on_sale BOOLEAN NOT NULL DEFAULT true;

UPDATE public.products
SET deduct_stock_on_sale = false
WHERE product_type = 'made';

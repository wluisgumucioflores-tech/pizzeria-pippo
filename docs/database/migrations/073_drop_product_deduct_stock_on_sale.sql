-- ============================================================
-- 073_drop_product_deduct_stock_on_sale.sql
--
-- Reverts 072: the per-product deduct_stock_on_sale switch is replaced by
-- 3 general (business-wide) app_settings keys, decided after the client
-- clarified the requirement — see docs/features/jefe-produccion/feature.md,
-- "Control de inventario" and roadmap-fases.md Fase 8:
--   - stock_deduct_resale       (default true)  — resale stock deduction
--   - stock_deduct_insumos      (default true)  — ingredient recipe deduction
--   - stock_deduct_made_unit    (default false) — made-in-house, deducted by
--     transferred unit; only applies if the business has enabled_modules.produccion
--
-- Those are plain app_settings rows (key-value), no schema change needed
-- for them. 072 was never applied to Supabase (only to the local Postgres),
-- so this is a clean revert, not a production rollback.
-- ============================================================

ALTER TABLE public.products
  DROP COLUMN IF EXISTS deduct_stock_on_sale;

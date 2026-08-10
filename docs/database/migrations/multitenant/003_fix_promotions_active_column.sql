-- Fix: la tabla promotions quedó sin la columna `active` (toggle de POS)
-- al armar el reset dev en 001_initial_schema_multitenant.sql. El schema
-- original (supabase/001_schema.sql) sí la tenía, junto con `is_active`
-- (soft-delete, agregada después en la migración productiva 002_soft_delete.sql).
-- Prisma la espera en todas las queries de promotions -> 500 en list/create/order.

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

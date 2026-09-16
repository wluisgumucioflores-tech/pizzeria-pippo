-- ============================================================
-- 069_production_role.sql
--
-- Phase 1 of docs/features/jefe-produccion/roadmap-fases.md — adds
-- the `produccion` role to profiles_role_check. It's the only schema
-- piece needed for this phase: a user with this role carries no
-- branch (branch_id is left NULL, already nullable) and its
-- ingredient/production records live in new tables created only in
-- Phase 2 (production_ingredient_logs / production_output_logs).
--
-- Doesn't touch profiles_business_id_required_unless_superadmin (068):
-- the produccion role DOES require business_id, it just doesn't require branch_id.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text, 'mesero'::text, 'superadmin'::text, 'produccion'::text]));

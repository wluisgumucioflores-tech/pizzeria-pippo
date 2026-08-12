-- ============================================================
-- 010_mesero_role.sql
--
-- Fase 1 del roadmap de docs/features/mesero-y-mejoras-pos/:
-- agrega el rol `mesero` (personal de salón, ver feature.md).
-- Es un rol operativo como cajero/cocinero — sigue requiriendo
-- business_id (no se toca profiles_business_id_required_unless_superadmin).
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin', 'cajero', 'cocinero', 'superadmin', 'mesero']));

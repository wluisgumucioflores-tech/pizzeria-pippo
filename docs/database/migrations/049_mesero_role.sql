-- ============================================================
-- 049_mesero_role.sql
--
-- Fase 1 del roadmap de docs/features/mesero-y-mejoras-pos/:
-- agrega el rol `mesero` (personal de salón, ver feature.md).
-- Es un rol operativo como cajero/cocinero.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text, 'mesero'::text]));

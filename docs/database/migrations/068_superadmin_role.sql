-- ============================================================
-- 068_superadmin_role.sql
--
-- Agrega el rol `superadmin` a profiles_role_check y vuelve
-- business_id nullable para ese rol (un superadmin no pertenece a
-- ningún negocio — panel /superadmin, ver CLAUDE.md).
--
-- Portado desde docs/database/migrations/multitenant/002_superadmin_role.sql
-- (esa carpeta fue un reset completo de un Supabase de DEV, no forma
-- parte de esta secuencia numerada). Solo se trae la parte de schema
-- (CHECK constraints); las políticas RLS de ese archivo referencian
-- get_user_business_id(), una función que no existe en esta secuencia
-- y que el backend no necesita — NestJS/Prisma autoriza por su cuenta
-- y no pasa por RLS.
--
-- IMPORTANTE: backend/prisma/schema.prisma ya documenta
-- profiles_business_id_required_unless_superadmin como si existiera en
-- producción, y el código ya usa @Roles('superadmin') en varios
-- controllers. Es posible que este cambio YA esté aplicado ahí (con
-- otro nombre o vía el track multitenant/) — antes de correrlo en
-- Supabase real, verificar con:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.profiles'::regclass
--     AND conname = 'profiles_role_check';
-- Si ya incluye 'superadmin', marcar esta migración como ✅ aplicada
-- en PENDING.md sin volver a correrla (el DROP+ADD de abajo no es
-- idempotente si el nombre de constraint difiere).
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text, 'mesero'::text, 'superadmin'::text]));

ALTER TABLE public.profiles
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_business_id_required_unless_superadmin;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_id_required_unless_superadmin
  CHECK (role = 'superadmin' OR business_id IS NOT NULL);

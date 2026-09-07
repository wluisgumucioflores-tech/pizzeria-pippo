-- ============================================================
-- 03_seed_superadmin.sql — Pizzería Pippo
-- Crea el usuario superadmin por defecto (dueño de la plataforma,
-- sin negocio asociado) para entorno local/dev.
--
-- Requiere 068_superadmin_role.sql ya aplicada (el rol 'superadmin'
-- debe estar permitido por profiles_role_check).
--
-- Auth 100% custom (ver CLAUDE.md) — el password se guarda con bcrypt
-- en profiles.password_hash, NO en auth.users (Supabase Auth no se
-- usa). pgcrypto's crypt()/gen_salt('bf', 10) genera el mismo formato
-- $2a$ que bcryptjs (backend/src/auth/password/password-hasher.service.ts,
-- SALT_ROUNDS=10) sabe validar con bcrypt.compare().
--
-- Credenciales por defecto (SOLO dev/local — cambiar antes de producción):
--   Email:    superadmin@pippo.dev
--   Password: superadmin-dev-2026
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.profiles (id, email, password_hash, role, full_name, business_id, branch_id)
VALUES (
  gen_random_uuid(),
  'superadmin@pippo.dev',
  crypt('superadmin-dev-2026', gen_salt('bf', 10)),
  'superadmin',
  'Superadmin',
  NULL,
  NULL
)
ON CONFLICT (email) DO NOTHING;

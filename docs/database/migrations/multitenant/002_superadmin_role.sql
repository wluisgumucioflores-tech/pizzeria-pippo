-- ============================================================
-- 002_superadmin_role.sql
--
-- Agrega el rol `superadmin` (dueño de la plataforma, ver
-- docs/features/multitenant/feature.md — actor "Superadmin").
-- Requiere 000+001 ya aplicados.
--
-- Un superadmin no pertenece a ningún negocio, así que
-- `profiles.business_id` vuelve a ser nullable — pero solo para
-- ese rol: el nuevo CHECK obliga a que cualquier otro rol sí
-- tenga negocio, para no perder la garantía que dábamos con NOT NULL.
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin', 'cajero', 'cocinero', 'superadmin']));

ALTER TABLE public.profiles
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_business_id_required_unless_superadmin
  CHECK (role = 'superadmin' OR business_id IS NOT NULL);

-- businesses: el superadmin debe poder ver todos los negocios, no solo el propio
-- (no tiene "propio" — business_id es NULL para su perfil)
DROP POLICY IF EXISTS "businesses_select_own" ON public.businesses;
CREATE POLICY "businesses_select" ON public.businesses FOR SELECT
  USING (
    id = (SELECT public.get_user_business_id())
    OR (SELECT public.get_user_role()) = 'superadmin'
  );

-- profiles: la policy original comparaba business_id = get_user_business_id(),
-- que para un superadmin es NULL = NULL (nunca true en SQL) — no podía ver
-- ni su propio perfil. Se agrega la rama de superadmin.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    (SELECT public.get_user_role()) = 'superadmin'
    OR (
      business_id = (SELECT public.get_user_business_id())
      AND (id = auth.uid() OR (SELECT public.get_user_role()) = 'admin')
    )
  );

-- Nota: el resto de las políticas (branches, products, orders, etc.) NO se
-- tocan acá a propósito. El superadmin de este paso solo necesita existir
-- y verse a sí mismo + la lista de negocios — no opera dentro de la data de
-- ningún comercio todavía (eso es "modo ver comercio", F3, ver feature.md).

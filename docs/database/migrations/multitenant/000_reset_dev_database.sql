-- ============================================================
-- 000_reset_dev_database.sql
--
-- ⚠️  SOLO PARA EL PROYECTO SUPABASE DE DESARROLLO. ⚠️
-- Borra TODO lo que haya en el schema `public` — tablas, vistas,
-- funciones y secuencias — sin importar el nombre. Es irreversible.
--
-- Por qué es dinámico y no una lista de DROP TABLE a mano: este
-- proyecto Supabase de dev tiene mezcladas tablas de otro proyecto
-- viejo que ya no se usa. En vez de mantener una lista curada que
-- puede quedar corta, se recorre pg_catalog y se borra todo.
--
-- Nunca correr esto contra producción (Pippo tiene datos reales ahí) —
-- ver docs/database/migrations/multitenant/README.md.
--
-- Confirmado con el usuario 2026-08-09: este es el Supabase de dev,
-- sin datos reales que importen, arranque limpio para el schema
-- multitenant.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Vistas primero (pueden depender de tablas/funciones)
  FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
  END LOOP;

  -- Tablas
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;

  -- Funciones (incluye las de RLS: get_user_role, get_user_branch_id,
  -- get_user_business_id, create_order_atomic, y cualquier otra del
  -- proyecto viejo)
  FOR r IN (
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.' || r.signature || ' CASCADE';
  END LOOP;

  -- Secuencias sueltas (las ligadas a una tabla ya se van con el DROP TABLE CASCADE)
  FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
  END LOOP;
END $$;

-- Verificación manual — deben devolver 0 filas:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';
-- SELECT viewname FROM pg_views WHERE schemaname = 'public';
-- SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public';

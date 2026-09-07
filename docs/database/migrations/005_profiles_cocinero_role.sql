-- ============================================================
-- 005_profiles_cocinero_role.sql
-- Agrega el rol 'cocinero' al CHECK constraint de profiles.role.
-- El rol cocinero accede solo a la pantalla KDS (/kitchen).
-- ============================================================

-- Eliminar el constraint viejo y recrearlo con el nuevo valor
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'cajero'::text, 'cocinero'::text]));

-- RLS: política para que el cocinero pueda actualizar kitchen_status en orders de su sucursal
-- Requiere que get_user_role() y get_user_branch_id() ya existan (creadas en 001_schema.sql)
-- Nota: "CREATE POLICY IF NOT EXISTS" no existe en PostgreSQL — nunca fue
-- sintaxis válida. Se corrige acá al DROP+CREATE (mismo patrón idempotente
-- usado en el resto de las migraciones), sin cambiar el efecto original.
DROP POLICY IF EXISTS "orders_kitchen_update" ON orders;
CREATE POLICY "orders_kitchen_update" ON orders
  FOR UPDATE
  USING (get_user_role() = 'cocinero' AND branch_id = get_user_branch_id())
  WITH CHECK (get_user_role() = 'cocinero' AND branch_id = get_user_branch_id());

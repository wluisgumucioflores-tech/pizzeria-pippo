-- Migración obligatoria: todos los negocios pasan a usar categorías reales
-- en BD (se elimina el flag opcional enabled_modules.categories). Corrida
-- idempotente — se puede volver a aplicar sin duplicar filas.

-- (a) Seedea las 3 categorías default en cualquier negocio que todavía no tenga ninguna
INSERT INTO categories (business_id, name, is_pizza, sort_order)
SELECT b.id, v.name, v.is_pizza, v.sort_order
FROM businesses b
CROSS JOIN (VALUES ('Pizza', true, 0), ('Bebida', false, 1), ('Otro', false, 2)) AS v(name, is_pizza, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.business_id = b.id);

-- (b) Backfill de products.category_id, match case-insensitive por nombre dentro del mismo negocio
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE c.business_id = p.business_id
  AND lower(c.name) = lower(p.category)
  AND p.category_id IS NULL;

-- Verificación manual: correr y revisar antes de dar por buena la migración.
-- No debería haber filas con sin_migrar = true.
-- SELECT category, category_id IS NULL AS sin_migrar, count(*) FROM products GROUP BY 1, 2;

-- (c) Relaja el constraint legado — ya no es la fuente de verdad, se mantiene
-- como espejo best-effort para lo poco que todavía lo lee (combo builder,
-- motor de promociones). Los negocios con categorías personalizadas (sin
-- equivalente legado) van a escribir category = NULL desde ahora.
ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
ALTER TABLE products DROP CONSTRAINT products_category_check;
ALTER TABLE products ADD CONSTRAINT products_category_check
  CHECK (category IS NULL OR category = ANY (ARRAY['pizza'::text, 'bebida'::text, 'otro'::text]));

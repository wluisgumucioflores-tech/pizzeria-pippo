# Migraciones — reinicio multitenant (Supabase dev)

Carpeta separada de `docs/database/migrations/` porque no es una migración incremental más — es un **reset completo** del proyecto Supabase de **desarrollo** para arrancar el trabajo de multitenant con el schema pensado desde el día 1 (`business_id` en cada tabla que lo necesita), en vez de ir agregando columnas nullable de a poco sobre datos ya existentes.

> [!warning] Solo para el Supabase de desarrollo
> `000_reset_dev_database.sql` borra **todo** el schema `public` (tablas, vistas, funciones, secuencias) de forma dinámica — recorre `pg_catalog` en vez de listar nombres a mano, porque este proyecto Supabase de dev tiene mezcladas tablas de otro proyecto viejo que ya no se usa. Nunca correr esto contra el proyecto de producción de Pippo — ahí sí aplica el enfoque incremental (nullable → backfill → NOT NULL) documentado en `docs/features/multitenant/plan-f0-f1-foundations.md`.

## Orden de aplicación (manual, SQL Editor de Supabase)

1. `000_reset_dev_database.sql` — borra todo lo existente en el proyecto dev
2. `001_initial_schema_multitenant.sql` — crea el schema completo con `business_id` ya incorporado, RLS básica y las funciones helper (`get_user_role`, `get_user_branch_id`, `get_user_business_id`)
3. `002_superadmin_role.sql` — agrega el rol `superadmin` (`profiles.business_id` vuelve a ser nullable, pero solo para ese rol)
4. Reaplicar manualmente `docs/database/migrations/047_orders_notes.sql` (última versión de `create_order_atomic`, es `CREATE OR REPLACE` — se puede correr sola una vez que existen las tablas)

## Qué NO incluye este reset

Alcance acotado a F0 (schema base). No incluye todavía:
- Columnas de negocio para F3 (slug, logo, plan, límites) — no están decididas como parte de F0, se agregan cuando arranque esa fase
- `BusinessGuard` ni scoping de los services de NestJS (F1) — el schema queda listo, pero el backend hoy no filtra por `business_id` en la mayoría de módulos, ver `docs/research/2026-06-09-multitenant-feasibility.md`
- RLS afinada por rol (la de este reset es una base razonable, no reemplaza la granularidad que fue creciendo en `docs/database/migrations/001-047` en producción)
- Buckets de Supabase Storage (imágenes de producto) — se crean aparte desde el dashboard, no vía SQL

# Investigación de viabilidad: multi-tenant (SaaS de comercios)

**Fecha:** 2026-08-09 (recreado — el archivo original referenciado desde [[20-multitenant]] se perdió; contenido reconstruido con una auditoría completa del código y la BD actual)
**Alcance:** qué existe hoy, qué falta y cuánto riesgo hay para convertir Pizzería Pippo en una plataforma multi-tenant real (varios comercios con datos completamente aislados).
**Relacionado:** [[20-multitenant]] (definición de producto) · `docs/database/migrations/034_businesses_multitenant.sql` · `docs/database/migrations/040_businesses_backfill.sql`

---

## 1. Resumen ejecutivo

Hoy la app es de **un solo negocio** de punta a punta. Hace tiempo se empezó un soporte multi-tenant (migración 034 + tabla `businesses`) pero quedó a medio camino:

- **No está aplicado en producción** (confirmado contra un dump real del 2026-07-14: no existe la tabla `businesses` ni la columna `business_id` en ningún lado).
- Incluso si se aplicara tal cual está hoy, **el aislamiento seguiría sin existir**: casi ninguna tabla de negocio (`branches`, `products`, `orders`, `promotions`, `stock`...) tiene `business_id`, y ni las políticas RLS de Supabase ni el backend NestJS filtran por negocio en ningún módulo salvo `settings`.
- El backend usa Prisma con conexión directa a Postgres, lo que **evita RLS** — así que el aislamiento real dependería 100% de que NestJS filtre cada query, y hoy prácticamente no lo hace.

**Conclusión de viabilidad:** es técnicamente viable (el patrón columna `tenant_id` + RLS es correcto y está confirmado como la decisión ya tomada en [[20-multitenant]]), pero es un trabajo grande y transversal — no una feature aislada. Toca la base de datos, cada módulo del backend, los guards de autorización y el realtime.

---

## 2. Qué existe hoy

| Pieza | Estado |
|---|---|
| Tabla `businesses` (migración 034) | Escrita, **no aplicada** en producción |
| `profiles.business_id`, `app_settings.business_id` (migración 034) | Escrita, **no aplicada** |
| Backfill de negocio único "Pizzería Pippo" (migración 040) | Escrito, **no aplicado**, y solo prepara un tenant — no un flujo de alta de negocios nuevos |
| `business_id` en el JWT / `CurrentUserPayload` | **Bien construido** — `current-user.mapper.ts` y `jwt.strategy.ts` lo resuelven en cada request desde `profiles.businessId` |
| Módulo que ya filtra correctamente por negocio | Solo `settings.service.ts` (vía `resolveBusinessId()`) — es la plantilla a replicar |
| Branch git `feature/multitenant` | Existe pero **no está relacionada** — su único commit es un rediseño de UX del flujo de venta del POS, sin nada de multi-tenant. Puede ignorarse. |

---

## 3. Qué falta — por capa

### 3.1 Base de datos / Prisma schema

Ninguna tabla de negocio tiene `businessId` en `backend/prisma/schema.prisma` salvo `Profile` y `AppSetting`. Faltan en:

`Branch`, `Product`, `VariantType`, `ProductVariant`, `Ingredient`, `Promotion`, `PromotionRule`, `WarehouseStock`, `WarehouseMovement`, `Employee`, `Device`.

`Order`, `OrderItem`, `StockMovement`, `BranchStock`, `Recipe` no necesitan la columna propia si `Branch` la tiene — se resuelven vía join a `branches.business_id`, pero eso exige que **todo filtro pase primero por sucursal**, lo cual hoy tampoco está garantizado en todos los servicios.

`products.business_id` aparece mencionado en el comentario de la migración 034 como si ya existiera en producción, pero **no está en `schema-base.sql` ni en ninguna migración documentada** — es un cabo suelto a resolver antes de tocar el módulo de productos.

### 3.2 Row Level Security (Supabase)

Revisadas todas las políticas activas (`032_fix_rls_security_warnings.sql`, `008_warehouse_rls.sql`): **ninguna usa `business_id`**, todas se basan en `get_user_role() = 'admin'` o `branch_id = get_user_branch_id()`. No existe función `get_user_business_id()`.

Esto es crítico si algo llega a pegarle a Supabase directo (hoy el frontend ya no lo hace, ver 3.3, pero RLS es la última línea de defensa y hoy no existe): un admin de cualquier negocio vería todos los negocios.

También: `businesses` tiene la política `authenticated_read_businesses USING (true)` — cualquier autenticado lee la lista completa de comercios (nombres de la competencia).

### 3.3 Backend NestJS

El frontend ya migró 100% a NestJS (no hay `supabase.from()` en `frontend/src`), así que **el backend es hoy el único punto real de aislamiento posible**. Estado por módulo:

| Módulo | Filtra por `business_id` |
|---|---|
| `settings` | ✅ Sí (único) |
| `auth` | ✅ Resuelve y expone el dato correctamente |
| `orders` | ⚠️ Solo lo usa para decidir qué bot de Telegram avisar — no filtra órdenes |
| `branches` (`list()`, admin) | ❌ Devuelve todas las sucursales de todos los negocios |
| `users` (`list()`) | ❌ Devuelve usuarios de todos los negocios |
| `products` | ❌ Catálogo 100% global |
| `promotions`, `stock`, `warehouse`, `ingredients`, `variant-types`, `employees`, `attendance`, `devices`, `reports`, `public-menu`, `payment-validation` | ❌ Sin ninguna referencia a `business_id` |

No existe ningún **guard de negocio**. Solo hay `RolesGuard` y `OwnBranchOrAdminGuard`, y este último tiene `if (user.role === 'admin') return true` — un bypass universal que dejaría pasar cruces de negocio también, si se replicara el mismo patrón sin cuidado.

No hay middleware/interceptor global que inyecte o valide `business_id` — todo sería manual, módulo por módulo.

### 3.4 Realtime (WebSocket)

`orders/realtime/orders.gateway.ts` aísla rooms **solo por `branch_id`**. Además tiene un bug independiente ya explotable hoy (documentado en memoria de deuda de seguridad): el `branchId` del handshake del cliente no se valida contra `user.branch_id`, por lo que cualquier autenticado puede unirse al room de cualquier sucursal. Cuando exista `business_id` en `Branch`, este gateway necesitará validar sucursal **y** negocio antes de aceptar la conexión — hoy no valida ninguno de los dos con rigor.

### 3.5 Frontend

Sin hallazgos de riesgo: el frontend no hace queries directas a Supabase, todo pasa por `nestFetch.ts` hacia el backend. Pero tampoco tiene por dónde soportar multi-tenant todavía:

- `frontend/src/lib/auth.ts` (`UserProfile`) y `authProvider.ts` (`getIdentity`) **no exponen `business_id`** — habría que agregarlo para cualquier UI futura (ej. selector de negocio para el superadmin en "modo ver comercio").
- No existe ningún selector de "negocio activo" en la UI (esperado — es parte del [[20-multitenant]], no un gap actual).

---

## 4. Lista priorizada (más crítico → menos crítico)

1. **Agregar `businessId` a `Branch` y de ahí en cascada** (`Product`, `Promotion`, `Ingredient`, `VariantType`, `Device`, `Employee`, `WarehouseStock`) en `schema.prisma` — migración + backfill. Sin esto no hay nada que filtrar en ningún módulo.
2. **Documentar y resolver `products.business_id`** — está mencionado como existente en un comentario pero no aparece en ningún schema ni migración real.
3. **Filtrar `users.service.ts:list()` y `branches.service.ts:list()` por `business_id`** — son las fugas más directas (listas completas de usuarios/sucursales de todos los negocios).
4. **Crear un `BusinessGuard`** (o extender `OwnBranchOrAdminGuard`) que valide `business_id` con el mismo rigor que hoy se valida `branch_id`, sin que el bypass de admin salte también el chequeo de negocio.
5. **Scoping por negocio en el resto de módulos**: `products`, `orders`, `promotions`, `stock`, `warehouse`, `reports`, `employees`, `attendance`, `devices`, `payment-validation`.
6. **`orders.gateway.ts`**: validar `branchId` del handshake contra el usuario (bug ya explotable hoy, independiente del multi-tenant) y, a futuro, contra el negocio.
7. **Reescribir RLS** con `get_user_business_id()` — aunque el backend sea la barrera principal (Prisma bypassea RLS), debe quedar como defensa secundaria correcta, no como política abierta.
8. **Acotar `authenticated_read_businesses`** — hoy expone todos los nombres de comercio a cualquier autenticado.
9. **Aplicar 034 + 040 en producción** una vez que lo anterior esté listo — aplicarlas hoy tal cual no logra aislamiento real, solo crea la tabla y un backfill de tenant único.
10. **Frontend**: exponer `business_id` en `auth.ts`/`authProvider.ts` cuando arranque la fase de UI (selector de negocio, panel superadmin) — no es riesgo de seguridad hoy, es bloqueante de UX a futuro.

---

## 5. Cómo se relaciona con [[20-multitenant]]

El feature ya definido plantea mucho más que aislamiento de datos: rol de superadmin, alta manual de comercios, branding por comercio, límites por plan. Esta investigación cubre exclusivamente el **prerrequisito técnico** — el aislamiento real a nivel de BD y backend — que [[20-multitenant]] ya identificaba como pre-requisito #1 ("la RLS actual tiene políticas abiertas... endurecerla es el pre-requisito #1").

## 6. Siguiente paso

Con esto ya se puede armar el plan de fases (`docs/features/multitenant/plan-f0-f1-foundations.md`, referenciado en [[20-multitenant]] pero igualmente perdido en su momento — ya recreado y en progreso) — probablemente:

- **Fase 0**: schema + migraciones + backfill (punto 1-2 de la lista)
- **Fase 1**: guards + scoping backend módulo por módulo (puntos 3-6)
- **Fase 2**: RLS + aplicar en producción (puntos 7-9)
- **Fase 3**: UI de superadmin y branding (alcance completo de [[20-multitenant]])

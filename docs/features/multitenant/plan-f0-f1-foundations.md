# Plan: Multitenant — Fase 0 y 1 (fundamentos de aislamiento)

**Fecha:** 2026-06-09
**Estado:** Fase 0 y Fase 1 completas en dev — schema multitenant, rol superadmin, businesses CRUD, y scoping de lectura+escritura por negocio en todos los módulos (secciones 3 y 4). Pendiente: validar en Supabase real con `npm run start`/`npm run dev` (Claude no ejecuta esos comandos), y las fases fuera de este plan (sección 5)
**Relacionado:** `docs/features/multitenant/feature.md` (definición de producto, repo) · `docs/research/2026-06-09-multitenant-feasibility.md` (investigación) · `features/testing/20-multitenant.md` (definición de producto, vault Obsidian)

---

## 1. Dónde entra este plan

El feature completo de multitenant (superadmin, branding, límites por plan) se divide en 4 fases. Este documento cubre **solo las primeras dos** — la base técnica sin la cual ninguna de las otras tiene sentido:

| Fase | Qué cubre | ¿Este plan? |
|---|---|---|
| **F0** | Schema Prisma + migraciones + backfill | ✅ Sí |
| **F1** | Guards + scoping backend módulo por módulo | ✅ Sí |
| F2 | Reescribir RLS + aplicar todo en producción | No — plan aparte, después de validar F0-F1 |
| F3 | UI de superadmin + branding por comercio | No — alcance completo del feature `20-multitenant.md` |

Todo lo de F0-F1 pasa **por debajo de la UI**: no cambia nada visible en Pippo. El objetivo es dejar la base de datos y el backend listos para filtrar por negocio, sin todavía activar un segundo negocio ni tocar pantallas.

---

## 2. Compatibilidad hacia atrás — cómo no romper los datos de Pippo

Esta es la pregunta central antes de tocar cualquier tabla: **hoy hay datos reales de producción y no se pueden perder ni quedar inconsistentes.**

La buena noticia es que ya existe un precedente que funcionó: las migraciones `034_businesses_multitenant.sql` y `040_businesses_backfill.sql` (escritas, no aplicadas aún) ya siguen el patrón correcto para `profiles` y `app_settings`:

1. **Columna nueva, siempre `NULLABLE`** — `ALTER TABLE ... ADD COLUMN business_id uuid REFERENCES businesses(id)`. Ninguna fila existente se rompe: no hay valor requerido todavía, así que ningún insert/update que ya existe en el código falla.
2. **Backfill al negocio único** — un `UPDATE ... SET business_id = (SELECT id FROM businesses LIMIT 1) WHERE business_id IS NULL`. Como hoy solo existe "Pizzería Pippo", **todas** las filas terminan apuntando al mismo negocio. Es mecánico, no hay ambigüedad de a qué negocio pertenece cada fila.
3. **Verificación explícita de 0 NULLs** antes de seguir — ya documentada como query manual al final de `040`.
4. **`NOT NULL` recién en una migración posterior**, y solo después de que el backend (Fase 1) ya escriba `business_id` en todo insert nuevo. Si se pone `NOT NULL` antes de que el código lo escriba, cualquier insert hecho por un módulo todavía no actualizado rompe en producción.

Este mismo patrón (nullable → backfill → verificar → recién ahí NOT NULL) se repite para **cada tabla nueva** en la Fase 0. No hay atajos: ninguna migración de este plan agrega una columna `NOT NULL` directamente.

**Por qué el comportamiento no cambia aunque se filtre por `business_id`:** mientras exista un solo negocio (Pippo), agregar `WHERE business_id = X` a una query no cambia ni una fila de lo que devuelve — todas las filas ya pertenecen a ese único negocio. El riesgo de F0-F1 es mecánico (una migración mal escrita, un `resolveBusinessId()` olvidado en algún service), no de negocio: no hay forma de que Pippo "pierda" datos o vea menos de lo que ve hoy, porque no hay un segundo negocio del cual diferenciarse todavía.

---

## 3. Fase 0 — Schema + migraciones + backfill

### 3.0 Resolver el cabo suelto de `products.business_id`

La migración `034` menciona en su comentario que `products.business_id` ya existía en producción, pero **no aparece en `schema-base.sql` ni en ninguna migración documentada**. Antes de tocar el módulo de productos:

- [ ] Confirmar contra un dump real de producción (`\d products` en el SQL Editor de Supabase) si la columna existe o no
- [ ] Documentar el hallazgo en una migración (`041_products_business_id_investigacion.sql`) con la nota correspondiente (`-- Ya aplicado el YYYY-MM-DD` si existe, o simplemente tratarlo como cualquier otra columna nueva del punto 3.1 si no existe)

### 3.1 Columnas nuevas (nullable + backfill, siguiendo el patrón de la sección 2)

- [ ] `042_branches_business_id.sql` — `branches.business_id` (nullable, FK a `businesses`) + backfill
- [ ] `043_*_business_id.sql` — mismo patrón para: `products`, `variant_types`, `ingredients`, `promotions`, `promotion_rules`, `warehouse_stock`, `warehouse_movements`, `employees`, `devices`

> [!note] Por qué estas tablas y no otras
> `orders`, `order_items`, `stock_movements`, `branch_stock`, `recipes` **no necesitan columna propia** — se resuelven vía join a `branches.business_id`. Pero eso exige que todo filtro pase primero por sucursal, lo cual hoy no está garantizado en todos los servicios (revisar como parte de la Fase 1, módulo por módulo).

- [ ] Actualizar `backend/prisma/schema.prisma`: cada campo nuevo como `String?` (opcional) mientras conviven filas backfilleadas y el código todavía no garantiza escritura en cada insert
- [ ] Actualizar `docs/database/schema-base.sql` después de aplicar cada migración (regla del `CLAUDE.md` del repo)

### 3.2 Endurecer a `NOT NULL` (migración separada, al final de F0/F1)

- [ ] Solo después de que Fase 1 esté completa (todo insert nuevo ya escribe `business_id`), correr la verificación de 0 NULLs por tabla y recién ahí aplicar `ALTER COLUMN business_id SET NOT NULL`
- [ ] Actualizar `schema.prisma` de `String?` a `String` en cada campo ya endurecido

---

## 3.3 Paso puente — escribir `businessId` en cada `create()` (dev)

Al resetear el Supabase de dev con `business_id NOT NULL` desde el día 1 (sección 2),
`tsc --noEmit` expuso de inmediato que ningún service escribe `businessId` al crear
filas — es la misma brecha que iba a aparecer en Fase 1, pero como error de compilación
en vez de bug silencioso. Es un paso mecánico (mismo patrón `resolveBusinessId(user)`
que ya usa `settings.service.ts`), **no** incluye todavía guards ni scoping de lectura
— eso sigue siendo la sección 4. Uno por uno, validando cada uno antes de seguir:

- [x] `branches.service.ts` — `create()` ahora recibe `user` y escribe `businessId`; controller actualizado para pasar `@CurrentUser()`
- [x] `devices.service.ts` — mismo patrón; spec actualizado (fixture `admin` con `business_id`)
- [x] `employees.service.ts` — mismo patrón; spec actualizado
- [x] `ingredients.service.ts` — mismo patrón; spec actualizado
- [x] `products.service.ts` — el más grande: `create()` recibe `user`; `duplicate()` hereda `businessId` del producto original (no del caller); `update()` lo resuelve solo si hace falta crear una variante nueva. Spec actualizado (3 tests)
- [x] `promotions.service.ts` — `create()` recibe `user`; `update()` reusa el `businessId` que ya devuelve `promotion.update()` para las reglas, sin query extra. Spec actualizado
- [x] `users.service.ts` — mismo patrón; spec actualizado
- [x] `variant-types.service.ts` — mismo patrón; spec no llamaba a `create()`, sin cambios ahí
- [x] `warehouse.service.ts` — `purchase`/`adjust`/`transfer` pasan a recibir `user: CurrentUserPayload` en vez de solo `userId: string` (necesario para resolver `businessId`); controller y spec actualizados
- [x] `warehouse-product.service.ts` — mismo patrón que `warehouse.service.ts`

**Checklist completo.** `tsc --noEmit` del backend: 0 errores. Suite completa: 295/296 (la única falla, `products.service.spec.ts › getVariantsWithDetails`, es preexistente y no relacionada — no se tocó ese método en esta sesión). `npm run start` ya debería levantar sin el error de compilación que lo bloqueaba.

---

## 3.4 Prerrequisito no planeado — rol `superadmin`

No estaba en la lista original, pero surgió antes de poder seguir con 3.3: para que
la app sea usable hace falta poder loguearse, y el actor "Superadmin" del feature
(`feature.md`, tabla de Actores) no encaja en el modelo `business_id NOT NULL` que
armamos en la sección 2 — un superadmin no pertenece a ningún negocio.

- [x] `docs/database/migrations/multitenant/002_superadmin_role.sql` — agrega `'superadmin'`
  al CHECK de `role`, vuelve `business_id` nullable **solo para ese rol**
  (`CHECK (role = 'superadmin' OR business_id IS NOT NULL)` preserva la garantía para
  el resto), y corrige `businesses_select`/`profiles_select` en RLS (el superadmin
  necesita ver todos los negocios y verse a sí mismo — la policy original comparaba
  `business_id = get_user_business_id()`, que para NULL = NULL nunca es `true`)
- [x] `schema.prisma`: `Profile.businessId` vuelve a `String?`, relación `business` opcional
- [x] `backend/prisma/seed-superadmin.ts` — script idempotente (`upsert` por email), crea
  un único perfil `role: 'superadmin'`, sin negocio ni sucursal. Corrido en dev:
  `superadmin@pippo.dev` / `superadmin-dev-2026` (solo dev, cambiar antes de cualquier uso real)
- [x] Guard/endpoint para que el superadmin realmente pueda operar — `src/businesses/` (`POST` crea negocio+admin en una transacción, `GET` lista, `PATCH :id` suspende/reactiva), protegido con `@Roles('superadmin')`. Sin DELETE (el feature doc pide suspender, no borrar) y sin enforcement todavía de que un negocio suspendido bloquee a sus usuarios (pendiente, no es parte de F0-F1)

## 4. Fase 1 — Guards + scoping backend, módulo por módulo

### 4.1 `BusinessGuard`

- [x] Decisión: no se crea un guard genérico. Para endpoints `list()` el scoping va directo en el `where` de Prisma (`resolveBusinessId(user)`); para endpoints por `:id` (`update`/`toggleBan`/`remove`/etc.) se agrega un método privado `assertOwnership(id, user)` en el propio service que hace `findUnique` y compara `businessId`, lanzando `NotFoundException` (no `403`, para no revelar que el id existe) si no coincide. Un guard genérico no serviría para estos casos porque el `business_id` del recurso no viaja en la request (ni body ni query), solo se conoce consultando la fila.

### 4.2 Orden de scoping (de mayor a menor riesgo, según la auditoría)

- [x] `users.service.ts` — `list()` filtra por `businessId` (profiles y el `order.findMany` usado para `has_orders`, vía `branch.businessId`); `update`/`toggleBan`/`remove` usan `assertOwnership`. Controller y spec actualizados. Tests: 297/298 (única falla preexistente y no relacionada, `products.service.spec.ts › getVariantsWithDetails`)
- [x] `branches.service.ts` — `list()` agrega `businessId` al `where` (además del filtro por rol ya existente); `update`/`setActive`/`remove` usan `assertOwnership`. Controller y spec actualizados. Tests: 299/300 (misma falla preexistente de `products`)
- [x] `variant-types.service.ts` — `list()` filtra por `businessId`; `update`/`setActive` usan `assertOwnership`; `assertNotInUse` (conteo de `productVariant` por nombre) ahora también filtra por `businessId` — antes contaba en uso variantes de cualquier negocio con el mismo nombre. Tests: 6/6
- [x] `ingredients.service.ts` — mismo patrón: `list()` con `businessId`, `update`/`softDelete` con `assertOwnership`. Tests: 13/13
- [x] `stock.service.ts` (insumos) — `list`/`getAlerts`/`getMovements` filtran vía `branch: { businessId }` (no tiene columna propia, se resuelve por join); `purchase`/`adjust` validan que `dto.branch_id` pertenezca al negocio antes de escribir (antes cualquier admin podía escribir stock en la sucursal de otro negocio pasando su UUID); `updateMinQuantity` usa `assertOwnership` vía el join a `branch`
- [x] `product-stock.service.ts` (reventa) — mismo patrón. Además corrige una fuga más amplia: estos endpoints no tenían ni `RolesGuard` ni `OwnBranchOrAdminGuard` (por diseño, ver comentario en el controller), así que antes de este cambio `list()`/`getResaleVariants()` sin filtro devolvían stock de reventa de **todos los negocios** a cualquier usuario autenticado
- [x] Efecto colateral: `telegram-ai.service.ts` llamaba a `stockService.list()`/`getAlerts()` sin contexto de usuario (el bot no tiene JWT). Se agregó `resolveFirstBusinessUser()`, mismo patrón ya documentado que usa `settings.service.ts` para Telegram (`business.findFirst()`, un solo negocio soportado por ahora — Telegram multitenant sigue fuera de este plan)
- [x] `warehouse.service.ts` (bodega insumos) y `warehouse-product.service.ts` (bodega reventa) — `warehouse_stock`/`warehouse_movements`/`warehouse_product_stock`/`warehouse_product_movements` ya tenían columna propia `businessId` (F0), así que `list`/`getMovements` filtran directo por `businessId`; `updateMinQuantity`/`remove` usan ownership vía `businessId` de la fila. Además, `purchase`/`adjust`/`transfer` (ya escribían `businessId` desde el "paso puente") ahora también validan que `ingredient_id`/`variant_id`/`branch_id` del body pertenezcan al negocio del usuario antes de escribir — mismo problema que en `stock.service.ts`: nada evitaba antes que un admin moviera stock de bodega usando IDs de otro negocio. Tests: 311/312 (misma falla preexistente de `products`)

Nota: el dashboard (`/dashboard`) depende de `stock.alerts` (✅ ya scoped) y `warehouse.stockLow` → `GET /warehouse/stock` (✅ ahora scoped con este cambio) — con esto el dashboard ya no mezcla alertas de bodega entre negocios. Sigue pendiente `reports` (ventas/top productos), que el dashboard también consume y todavía no filtra por `businessId`.

- [x] `reports.service.ts` — `Order` no tiene columna propia `businessId` (se resuelve vía `branch.businessId`, como `orders`/`order_items` en general); se agregó al `where` central (`buildWhere`/`buildOrdersHistoryWhere`, usados por `getSales`/`getDaily`/`getTopProducts`/`getCashiers`/`getOrders`). Sin esto, el dashboard mezclaba ventas y top de productos de **todos los negocios**. `telegram-ai.service.ts` también llama a estos métodos (bot sin JWT) — se conectó con el `resolveFirstBusinessUser()` ya agregado para `stockService`. Tests: 311/312 (misma falla preexistente de `products`)

Con esto, el dashboard queda completamente scoped por negocio (los 3 endpoints de los que depende: `reports.*`, `stock.alerts`, `warehouse.stockLow`).

Nota pendiente (no arreglada ahora, queda para cuando toque `promotions`): `telegram-ai.service.ts:handlePromotionsQuery` consulta `prisma.promotion.findMany` directo, sin filtrar por negocio — es una fuga del dominio de promociones expresada fuera de `promotions.service.ts`, así que se corrige junto con ese módulo.

- [x] `products.service.ts` (el módulo más grande) — todos los métodos de lectura (`list`, `getDetail`, `getPosCatalog`, `listAllVariants`, `getBranchPrices`, `getVariantsWithDetails`) filtran por `businessId`; todos los de escritura por id (`update`, `setActive`, `remove`, `duplicate`, `upsertBranchPrice`) verifican ownership antes de tocar la fila. Fugas encontradas:
  - `duplicate(id)` no verificaba que el producto original perteneciera al negocio del caller — un admin podía duplicar productos de otro negocio conociendo el id.
  - `getPosCatalog(branchId)` no filtraba por negocio en absoluto; para productos `resale` (que no exigen `branch_price`) esto significaba que el catálogo del POS mostraba productos de reventa de **todos los negocios**, no solo el propio.
  - `upsertBranchPrice` no validaba que `variant_id`/`branch_id` del body pertenecieran al negocio — mismo patrón de "escribir con IDs ajenos" que en `stock`/`warehouse`.
  - De paso, `update()` se simplificó: el ownership check upfront (`product.findUnique` con `businessId`+`productType`) reemplaza tanto el fetch condicional de `productType` como el fetch perezoso de `businessId` para variantes nuevas que existían antes — ya no hace falta ninguno de los dos por separado.
  Tests: 317/318 (misma falla preexistente de `getVariantsWithDetails`, no tocada)
- [x] `promotions.service.ts` — `list()`/`getById()` filtran/verifican por `businessId`; `update`/`patch`/`remove` usan `assertOwnership`. Efecto colateral encontrado: `orders.service.ts:create()` llama a `promotionsService.list({})` para recalcular precios/promos server-side al crear una orden — sin el `user` ahora habría fallado; ya pasa el `user` que `create()` ya recibe. También se corrigió `telegram-ai.service.ts:handlePromotionsQuery` (la fuga anotada la sesión pasada): consultaba `prisma.promotion.findMany` directo sin filtrar por negocio, ahora usa `resolveFirstBusinessUser()`. Tests: 321/322 (misma falla preexistente de `products`)

- [x] `employees.service.ts` — `list()` filtra por `businessId`; `update`/`setActive`/`regenerateCredential` usan `assertOwnership`. `verifyCredential()` (usado por fichaje) queda sin cambios a propósito: busca por hash de credencial contra todos los empleados activos, el token/código es el límite de seguridad ahí, no el negocio — mismo criterio que `DevicesService.verifyApiKey`.
- [x] `attendance.service.ts` — `history()` filtra vía `branch.businessId` (la tabla no tiene columna propia). `scan()` (fichaje) no lleva JWT — la identidad viene enteramente de la credencial verificada en `EmployeesService.verifyCredential`, no hace falta scoping ahí.
- [x] `devices.service.ts` — `list()` filtra por `businessId`; `update()` usa ownership check. `verifyApiKey()` sin cambios, mismo criterio que `verifyCredential`.
- [x] `public-menu.service.ts` (landing pública, sin JWT) — no hay forma de saber el negocio sin subdominios (fuera de este plan), así que se aplicó el mismo patrón "primer negocio" que ya usa Telegram (`business.findFirst()`). Nota: esta landing está deshabilitada desde que `/` redirige a `/login`, así que hoy no tiene tráfico real, pero quedó corregido por si se reactiva o se pega directo al endpoint.
- [x] `payment-validation.service.ts` — estado 100% en memoria (no toca Prisma salvo este chequeo nuevo), ya aislado por `branchId` como key. Se encontró que `start()` no validaba que el `branch_id` del body perteneciera al negocio del cajero — un cajero del negocio B podía registrar una espera de pago sobre una sucursal del negocio A. Se agregó el chequeo (mismo patrón `assertBranchOwnership` que en `stock`/`warehouse`). **No se tocó** la vulnerabilidad ya documentada en la sección 4.3 (el room de WebSocket no valida `branchId` contra `user.branch_id` en el handshake) — eso sigue pendiente como trabajo de Realtime, separado de este scoping de REST.

Tests tras este bucket: 323/324 (misma falla preexistente de `products`).

## Checklist de scoping de lectura — completo

Sección 4.2 completa: `users`, `branches`, `variant-types`, `ingredients`, `stock`, `warehouse`, `reports`, `products`, `promotions`, `employees`, `attendance`, `devices`, `public-menu`, `payment-validation` — todos filtran por negocio tanto en lectura como en escritura por id.

Pendiente real y ya documentado: **4.3 Realtime** — el `branchId` del handshake de `orders/realtime/orders.gateway.ts` no se valida contra `user.branch_id`/`business_id`, cualquier autenticado puede unirse al room de cualquier sucursal (de cualquier negocio). Es el siguiente punto lógico después de este checklist.
- [x] `orders.service.ts` — encontrado con `/docs/database/migrations/033_create_order_atomic.sql` como disparador. Cinco huecos, no solo lectura: `getDayOrders`/`getPendingKitchenOrders` no validaban el `branchId` del query param contra el negocio (igual que `stock`/`warehouse`); `markReady`/`cancelOrder` tenían el mismo bypass de admin sin acotar que ya se había señalado para `OwnBranchOrAdminGuard` — `if (user.role !== 'admin') return` dejaba pasar a un admin de OTRO negocio a marcar lista o anular una orden ajena conociendo el UUID; y `create()` tampoco validaba el `branch_id` del body — cualquier cajero podía crear una orden en la sucursal de OTRO negocio mandando ese id, ya que `create_order_atomic` (la función SQL) confía ciegamente en el `branch_id` recibido. Se agregó `assertBranchOwnership` (para los dos GET y para `create`, antes de tocar precios/stock) y el chequeo de `order.branch.businessId` (para `markReady`/`cancelOrder`), este último corre ANTES de cualquier bypass por rol. Tests: 328/329 (misma falla preexistente de `products`)
- [ ] `employees`, `attendance`, `devices`, `reports`, `public-menu`, `payment-validation`

Cada service sigue el patrón ya probado en `settings.service.ts` (`resolveBusinessId(user)` privado + `where: { businessId, ... }` en cada query Prisma) — es la plantilla a copiar, no a reinventar.

### 4.3 Realtime

- [x] `orders/realtime/orders.gateway.ts`: el bug era doble. (1) `branchId = query.branchId ?? user.branch_id` — el valor de la query tenía prioridad sobre el del JWT, así que un no-admin podía mandar cualquier `branchId` y unirse a ese room. Fix: los no-admin ya ni miran la query, siempre se unen a `user.branch_id`, sin excepción. (2) Para admin, que sí puede elegir sucursal (multi-sucursal dentro de su negocio), ahora se valida con una consulta a `branch.findUnique` que esa sucursal pertenezca a `user.business_id` antes de unirlo al room — antes un admin (o cualquiera con ese bypass) podía unirse al room de una sucursal de **otro negocio**. Tests: 325/326 (misma falla preexistente de `products`)

### 4.4 Validación de que no hay regresión (Pippo sigue igual)

Como hoy hay un solo negocio, filtrar por `business_id` no debería cambiar ni una fila de lo que ve un usuario de Pippo. Validar módulo por módulo:

- [ ] Correr la suite de tests existente (`pippo-project/tests`) después de scopear cada módulo
- [ ] Comparar manualmente conteos antes/después en al menos un endpoint por módulo (deben ser idénticos)

---

## 5. Fuera de este plan

- **Fase 2** (RLS con `get_user_business_id()`, acotar `authenticated_read_businesses`, aplicar `034`+`040`+migraciones de este plan en producción) — plan aparte, después de validar F0-F1 completo
- **Fase 3** (UI de superadmin, branding por comercio) — alcance completo de `20-multitenant.md`, plan aparte

---

## 6. Validación por fase

| Fase | Cómo se valida |
|---|---|
| 3.0 | Confirmado si `products.business_id` existe o no en el dump real; documentado en migración |
| 3.1 | Cada tabla tiene la columna nueva, 0 filas con `business_id IS NULL` tras el backfill |
| 3.2 | `NOT NULL` aplicado sin error en ninguna tabla (implica que Fase 1 ya escribe `business_id` en todo insert) |
| 4.1 | `BusinessGuard` tiene test unitario que confirma que el bypass de admin **no** cruza negocios |
| 4.2 | Por cada módulo scopeado: mismos resultados que antes de scopear (Pippo es el único negocio) |
| 4.3 | Conexión al gateway con `branchId` de otra sucursal/negocio es rechazada |

# Roadmap de fases — Jefe de Producción

Ver `feature.md` para objetivo, actores, alcance y decisiones. Este documento tiene el detalle técnico fase por fase. Cada fase se implementa y valida por separado — no se arranca la siguiente sin confirmar la anterior. Orden de ejecución = orden numérico, sin saltos.

## Tabla resumen

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| 1 | **Superadmin — asignación de roles por negocio** | — | ✅ Hecho |
| 2 | Tablas de bitácora (`production_ingredient_logs`, `production_output_logs`) | Fase 1 | ✅ Hecho |
| 3 | Backend — módulo `production` (endpoints de registrar/listar) | Fase 2 | ✅ Hecho y validado por el usuario (curl) |
| 4 | Frontend — panel `/produccion` (con menú lateral tras feedback del usuario) | Fase 3 | ✅ Hecho (falta probar en navegador) |
| 5 | Reportes — pestaña "Producción" | Fase 3 | ✅ Hecho (falta probar en navegador) |
| 6 | Usuarios — UI del rol en `UserModal` | Fase 1 | ✅ Hecho (adelantada) |
| 7 | Traducciones (transversal) | Fase 1+ | ✅ Hecho |
| 8 | Control de inventario — 3 switches generales en Configuración → Inventario (reventa/insumos/elaboración por unidad) | — | ✅ Hecho |
| 10 | Transferencia bodega→sucursal para el jefe de producción | Fase 8 | ✅ Hecho |
| 11 | Reportes — stock de elaborados restante en "Por cajero" | Fase 10 | ✅ Hecho |
| 9 | `tsc --noEmit` final + actualizar `schema-base.sql`/`PENDING.md` | Todas | Pendiente |

---

## Fase 1 — Superadmin: asignación de roles por negocio

### Qué entrega

El superadmin puede habilitar/deshabilitar el rol `produccion` por negocio (tenant), reutilizando el mecanismo `enabledModules` que ya existe para otras features. Con el módulo habilitado, el admin del negocio puede crear un usuario real con ese rol (sin sucursal asignada) y esa persona puede loguearse.

**No incluye todavía**: el panel `/produccion` (cae en el redirect por defecto tras loguear), ni las tablas de bitácora para registrar insumo/producción (eso es Fase 2/3). El corte de acceso real al apagar el módulo tampoco se puede verificar del todo hasta la Fase 3 (recién ahí existe un endpoint que chequee el flag en cada request).

### Backend

- **Migración** `docs/database/migrations/069_production_role.sql`: agregar `'produccion'` a `profiles_role_check` únicamente (sin tablas todavía). Actualizar `docs/database/migrations/PENDING.md`; actualizar `docs/database/schema-base.sql` recién después de aplicarla en Supabase.
- `packages/shared/src/constants/business-modules.ts`: agregar `produccion` a `BUSINESS_MODULE_KEYS`, al tipo `EnabledModules` y a `DEFAULT_ENABLED_MODULES` (default `false`).
- `backend/src/auth/types/jwt.types.ts` + `backend/src/auth/current-user.mapper.ts`: `CurrentUserPayload += enabled_modules: EnabledModules`, poblado desde `profile.business.enabledModules` (`JwtStrategy.validate()` ya trae `business` incluido) + `DEFAULT_ENABLED_MODULES` como merge.
- `backend/src/users/dto/create-user.dto.ts` y `update-user.dto.ts`: agregar `'produccion'` al `@IsIn([...])`. No exigir `branch_id` para este rol.
- `backend/src/users/users.service.ts` (`create`/`update`): si `dto.role === 'produccion'`, validar `user.enabled_modules.produccion === true` — 400 si no ("Tu negocio no tiene habilitado el rol de producción").

### Frontend

- `frontend/src/features/businesses/components/BusinessModal.tsx` y `BusinessEditModal.tsx`: agregar el checkbox "Producción" al `Checkbox.Group` existente sobre `BUSINESS_MODULE_KEYS`.
- `frontend/src/lib/auth.ts`: `UserRole += "produccion"` (solo para que el tipo compile y el login no rompa — el redirect a `/produccion` se agrega en la Fase 4).

### Cómo probarla

1. Como superadmin, editar un negocio de prueba y tildar "Producción". Confirmar en DB que `businesses.enabled_modules` tiene `"produccion":true`.
2. Como admin de ese negocio, crear un usuario con rol `produccion` (por API si la UI de Usuarios todavía no lo expone — eso es Fase 6): `POST /users` con `role: "produccion"`, sin `branch_id`. Debe crearse sin error.
3. Loguear con ese usuario (`POST /auth/login`) → debe devolver un JWT válido (cae en el redirect por defecto del frontend, no en `/produccion` todavía — esperado).
4. Con otro negocio de prueba donde el módulo NUNCA se habilitó, repetir el paso 2 → debe rechazar con 400.
5. Deshabilitar el módulo en el primer negocio (ya con el usuario creado) → intentar loguear de nuevo con ese usuario debe seguir funcionando (el corte real de funcionalidad recién existe en la Fase 3) — dejar anotado para no confundir con un bug.

### Hallazgos durante la implementación

- Agregar `enabled_modules` a `CurrentUserPayload` rompió la compilación en ~24 archivos (specs que construían el mock a mano + 2 call sites sintéticos en `telegram-ai.service.ts`/`telegram-chat-ia-webhook.controller.ts`, ninguno usa el flag `produccion` así que se les dio `DEFAULT_ENABLED_MODULES` sin ir a buscar el negocio real). Se corrigió todo, `tsc --noEmit` y la suite de tests quedan limpios (los 12 tests que siguen fallando en `orders.service.spec.ts`/`products.service.spec.ts` son preexistentes en `main`, confirmado con `git stash`, no relacionados a este feature).
- Migración `069_production_role.sql` aplicada en el Postgres local (`pippo_db`, Docker) — verificado que `profiles_role_check` ya incluye `'produccion'`. **No aplicada en Supabase real** — por eso `schema-base.sql` todavía no se actualiza (regla del proyecto: solo después de aplicar en Supabase).
- La Fase 6 (UI del rol en Usuarios) se adelantó junto con la Fase 1 a pedido del usuario, para poder probar el flujo completo por UI sin necesitar curl.
- **Amendment tras probar la Fase 1**: el usuario aclaró que no quería gatear solo `produccion`, sino que el superadmin pudiera elegir, por negocio, CUALQUIERA de los 5 roles (incluso `admin`/`cajero`, sin excepción). Se generalizó todo el mecanismo:
  - `packages/shared/src/constants/business-modules.ts`: nuevas claves `admin`/`cajero` en `EnabledModules` (default `true`, para no romper negocios existentes que nunca configuraron esto) + `ROLE_MODULE_MAP` (`admin→admin`, `cajero→cajero`, `cocinero→kitchen`, `mesero→mesero`, `produccion→produccion` — cocinero/mesero reusan los módulos ya existentes en vez de crear claves redundantes).
  - `backend/src/users/users.service.ts`: `assertRoleAllowed()` ahora usa `ROLE_MODULE_MAP` genérico en vez de solo chequear `produccion`.
  - `frontend/src/features/users/constants/user.constants.ts`: `getRoleOptions()` filtra los 5 roles con el mismo mapa.
  - `frontend/src/features/businesses/constants/modules.constants.ts`: nuevo `ROLE_MODULE_KEYS`/`FEATURE_MODULE_KEYS` para separar visualmente "roles" de "otros módulos" en el formulario del superadmin.
  - `BusinessModal.tsx`/`BusinessEditModal.tsx`: **bug encontrado y corregido durante la implementación** — el primer intento usó dos `Checkbox.Group` distintos apuntando al mismo campo de formulario (`enabled_modules_selected`); en AntD esto hace que tildar una casilla de un grupo pise (vacíe) las selecciones del otro grupo, porque cada `Checkbox.Group.onChange` devuelve solo el subconjunto de sus propias `options`. Se corrigió usando dos campos de formulario separados (`role_modules_selected` / `feature_modules_selected`) que se combinan recién en `handleFinish`.
  - `useBusinesses.ts`: `openEdit()` actualizado para poblar ambos campos nuevos (mantiene el patrón `resetFields()` antes de `setFieldsValue()`).
- **Hallazgo de entorno (no es bug de código)**: tras agregar `admin`/`cajero` a `packages/shared`, el usuario reportó que esos dos roles específicos "no se guardaban". Causa: ni `nest start --watch` ni el dev server de Next.js re-cargan un paquete de workspace hermano (`@pippo/shared`) cuando cambia su `dist/` — solo watchean su propio `src/`. Confirmado con `GET /businesses` directo contra el backend corriendo: devolvía `enabled_modules` sin `admin`/`cajero` a pesar de que el `dist/` en disco ya los tenía. Se resolvió reiniciando ambos `npm run dev`. **Recordatorio para el resto de las fases**: cada vez que se edite algo en `packages/shared/src/`, además de correr `npm run build` ahí, avisar al usuario que reinicie sus `npm run dev` (backend y frontend) antes de probar.

### Cómo probarla (actualizado tras Fase 6)

Con la Fase 6 ya hecha, el paso 2 del checklist original se puede hacer por UI: Usuarios → Crear usuario → la opción "Jefe de Producción" aparece en el selector de rol solo si el superadmin habilitó el módulo para ese negocio, y el campo sucursal se deshabilita automáticamente al elegir ese rol.

---

## Fase 2 — Tablas de bitácora ✅

### Qué entrega

`production_ingredient_logs` y `production_output_logs` creadas en la base, listas para que el módulo backend de la Fase 3 escriba/lea.

### Backend

- Migración `docs/database/migrations/070_production_logs.sql` (069 ya se aplicó solo con el rol, tanto local como pendiente en Supabase — se crea un archivo nuevo en vez de ampliarla).
- `production_ingredient_logs`: `id uuid PK, business_id uuid FK businesses, ingredient_id uuid FK ingredients, quantity numeric NOT NULL, notes text, created_by uuid FK profiles, created_at timestamptz DEFAULT now()`.
- `production_output_logs`: `id uuid PK, business_id uuid FK businesses, variant_id uuid FK product_variants, quantity numeric NOT NULL, notes text, created_by uuid FK profiles, created_at timestamptz DEFAULT now()`.
- `backend/prisma/schema.prisma`: modelos `ProductionIngredientLog`/`ProductionOutputLog` + relaciones.

Verificado en el Postgres local con `\d production_ingredient_logs`/`\d production_output_logs` — FKs a `businesses`/`ingredients`/`product_variants`/`profiles` correctas, RLS + policies aplicadas (checklist de `docs/database/README.md`, aunque el backend NestJS bypassea RLS al conectarse como superusuario — ver comentario en la migración).

### Cómo probarla

Ya cubierto en la verificación de Fase 3 (ambas se implementaron juntas).

---

## Fase 3 — Backend: módulo `production` ✅

### Qué entrega

Endpoints para que el jefe de producción registre y liste sus propios movimientos.

### Backend

- Nuevo `backend/src/production/` (`production.module.ts`, `production.controller.ts`, `production.service.ts`, `dto/`, `types/production-log.types.ts`, `production.service.spec.ts`).
- `ProductionService.logIngredientUsage(dto, user)` / `logOutput(dto, user)`: `create()` sobre las tablas nuevas, `business_id = user.business_id`, `created_by = user.id`. Además valida que el `ingredient_id`/`variant_id` pertenezca al negocio del usuario (404 si no — mismo patrón `assertOwnership` que `ingredients.service.ts`/`users.service.ts`, evita que alguien referencie un insumo/producto de otro negocio adivinando el UUID).
- `ProductionService.listIngredientUsage(query, user)` / `listOutput(query, user)`: filtrado por `business_id` + rango `from`/`to` opcional (timezone Bolivia, mismos helpers que `reports.service.ts`), orden por `created_at desc`, incluye nombre de insumo/producto y del creador.
- `ProductionController`: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('produccion', 'admin')` a nivel de clase. Endpoints: `POST /production/ingredient-usage`, `POST /production/output`, `GET /production/ingredient-usage`, `GET /production/output`. Cada método de servicio valida `user.enabled_modules.produccion` (403 `ForbiddenException` si no) — **acá sí se ejerce el corte de acceso real** si el superadmin apaga el módulo después de creado el usuario (la Fase 1 solo lo cortaba en la creación/edición de usuarios).
- Registrado `ProductionModule` en `backend/src/app.module.ts`.
- `tsc --noEmit` limpio, 10 tests nuevos en `production.service.spec.ts` (creación, rechazo por módulo apagado, rechazo por insumo/variante de otro negocio, mapeo de listados) — suite completa del backend sigue con los mismos 12 fallos preexistentes de siempre, nada nuevo roto.

### Cómo probarla

Con un usuario `produccion` de un negocio con el módulo habilitado (Fase 1) y token en mano:
```bash
curl -X POST http://localhost:3333/production/ingredient-usage \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"ingredient_id":"<uuid de un insumo de ese negocio>","quantity":5,"notes":"prueba"}'

curl -X POST http://localhost:3333/production/output \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"variant_id":"<uuid de una variante de ese negocio>","quantity":40}'

curl http://localhost:3333/production/ingredient-usage -H "Authorization: Bearer <token>"
curl http://localhost:3333/production/output -H "Authorization: Bearer <token>"
```
Debe crear las filas y listarlas con nombre de insumo/producto resuelto. Apagando el módulo desde el panel de negocios del superadmin, cualquiera de los 4 endpoints debe devolver 403 en el siguiente request.

---

## Fase 4 — Frontend: panel `/produccion` ✅

### Qué entrega

El jefe de producción puede loguearse y usar el panel real (esto es lo que el cliente quiere ver funcionando primero para probarlo con un usuario real).

### Frontend

- `frontend/src/app/produccion/layout.tsx` (patrón de `frontend/src/app/kitchen/layout.tsx`, además redirige a `/login` si `profile.enabled_modules.produccion` es `false`) — **amendment**: el usuario pidió un menú lateral como el panel admin en vez de un único scroll con ambos formularios. Se armó un sidebar liviano con `antd Layout/Menu` (dos ítems: Insumos/Producción) en vez de reusar el `Refine`+`ThemedSider` del admin — ese stack completo (resources, authProvider, routing) es overkill para 2 links estáticos y ningún otro panel de rol (kitchen/mesero) lo usa.
- Rutas: `/produccion` (redirect a `/produccion/insumos`), `/produccion/insumos/page.tsx`, `/produccion/elaboracion/page.tsx` — cada una renderiza un solo formulario ahora, en vez de las dos tarjetas apiladas del primer intento.
- **Segundo amendment**: labels del menú acortados a "Insumos"/"Producción" (namespace `production.menu.*`, separado del título largo de cada formulario) + botón "Cerrar sesión" abajo del sidebar (`signOut()` de `@/lib/auth` + redirect a `/login`) — ningún otro panel de rol (kitchen/mesero) tenía logout, pero acá sí se pidió porque el panel ahora tiene navegación propia.
- **Tercer amendment**: el usuario pidió la misma plantilla que usan Productos/Insumos/Categorías en el admin — tabla como vista principal + botón "+ Registrar" arriba a la derecha que abre un modal con el formulario, en vez del formulario inline siempre visible. Se reestructuró siguiendo el patrón exacto de `frontend/src/features/ingredients/components/IngredientsTable.tsx`/`IngredientModal.tsx`:
  - `IngredientUsageForm.tsx`/`ProductionOutputForm.tsx` (inline) reemplazados por `IngredientUsageTable.tsx`+`IngredientUsageModal.tsx` y `ProductionOutputTable.tsx`+`ProductionOutputModal.tsx`.
  - Hooks (`useIngredientUsage.ts`/`useProductionOutput.ts`) agregan `modalOpen`/`openCreate`/`closeModal`, mismo shape que `useIngredients.ts`.
  - Traducciones: `ingredientUsage.title`/`output.title` ahora son el título de la tabla (ej. "Insumos usados"), con `new`/`modalTitle` nuevos para el botón y el modal.
- **Cuarto amendment**: se agregó editar/eliminar a ambas tablas, mismo patrón que `CategoriesTable.tsx` (columna "Acciones" con lápiz + `Popconfirm` de borrado). Esto requirió ampliar el backend:
  - `ProductionService`: nuevos `updateIngredientUsage`/`deleteIngredientUsage`/`updateOutput`/`deleteOutput`, cada uno con su propio chequeo de ownership sobre el registro (`assertIngredientUsageLogOwnership`/`assertOutputLogOwnership` — 404 si el registro pertenece a otro negocio) además del chequeo ya existente sobre el insumo/producto referenciado.
  - `ProductionController`: `PATCH`/`DELETE` en `/production/ingredient-usage/:id` y `/production/output/:id`.
  - Sin restricción por creador — cualquier `produccion`/`admin` del negocio puede editar/borrar cualquier registro (igual criterio que `admin` ya tiene sobre insumos/categorías), no solo el que lo creó.
  - 9 tests nuevos en `production.service.spec.ts` (update/delete, éxito y rechazo por negocio ajeno).
  - Frontend: `ProductionService` (update/delete por id), hooks con `editing`/`openEdit`/`handleDelete`, modales con título dinámico ("Registrar" vs "Editar").
- **Quinto amendment**: el selector de "Producción" solo debe ofrecer productos de elaboración propia (`product_type='made'`), no de reventa — no tiene sentido que el jefe de producción "elabore" algo que se compra ya hecho.
  - `ProductsService.listAllVariants(user, productType?)` (backend, usado también por el combo builder de promociones): nuevo parámetro opcional, sin romper al caller existente que no lo pasa.
  - `ProductsController`: `GET /products/all-variants?productType=made` opcional.
  - `frontend/src/lib/api-endpoints.ts`: nuevo `products.allVariantsByType(productType)`, sin tocar `products.allVariants` (que sigue usando promociones sin filtro).
  - `ProductionService.getVariants()` (frontend) ahora pide `productType=made` explícitamente.
  - Test nuevo en `products.service.spec.ts` cubriendo el filtro.
- **Sexto amendment**: en la tabla de cada panel (insumos/producción) se pidió renombrar la columna "Cuándo" a "Fecha creación", sacar el campo "Notas" del formulario y de la columna, y agregar paginación + filtro por rango de fecha.
  - Backend: sin cambios — `ProductionService.listIngredientUsage`/`listOutput` ya soportaban `from`/`to`/`page`/`pageSize` desde la Fase 3, solo no se estaban usando desde el frontend.
  - `frontend/src/lib/api-endpoints.ts`: `production.ingredientUsageList(qs)`/`production.outputList(qs)` (la ruta base `ingredientUsage`/`output` queda solo para el POST).
  - `production.service.ts` (frontend): `getIngredientUsageLogs`/`getOutputLogs` ahora reciben `{page, pageSize, from, to}` y devuelven `{data, total}`; los payloads de create/update ya no incluyen `notes`.
  - `useIngredientUsage.ts`/`useProductionOutput.ts`: migrados de `useState`+`useEffect` a `useSWR` (mismo patrón que `useIngredients.ts`), con `page`/`dateRange` en el `swrKey` — cambiar de página o de rango de fecha dispara un nuevo fetch al backend en vez de filtrar en memoria. `mutate()` reemplaza al `fetchLogs()` manual tras crear/editar/borrar.
  - `IngredientUsageTable.tsx`/`ProductionOutputTable.tsx`: columna "Notas" eliminada, columna `when` ahora dice "Fecha creación"/"Creation date", `Table.pagination` conectado a `page`/`total`/`pageSize` del hook, `RangePicker` (`allowClear`, sin preset) en el header junto al botón de crear.
  - `IngredientUsageModal.tsx`/`ProductionOutputModal.tsx`: campo "Notas" (`Input`) eliminado del formulario.
  - `frontend/src/app/produccion/layout.tsx`: se agregó `ConfigProvider` con locale `es_ES`/`en_US` de AntD (mismo patrón que `(admin)`/`(pos)`), necesario para que el `RangePicker` muestre los textos en el idioma correcto — el panel de producción no lo tenía porque hasta ahora no usaba ningún componente de AntD sensible al locale.
  - Traducciones: se sacaron `production.notes`/`production.notesPlaceholder`/`production.table.notes` (quedaron sin uso) de `es.json`/`en.json`.
  - `tsc --noEmit` limpio en frontend. Sin cambios de backend, no hizo falta correr la suite de Jest.
- **Séptimo amendment**: el panel no era responsive en mobile — el `Sider` fijo de 220px (heredado del primer amendment) se comía casi la mitad de una pantalla de celular y desconfiguraba el layout.
  - `frontend/src/app/produccion/layout.tsx`: se agregó `useIsMobile()` (`@/lib/useIsMobile`, mismo hook que ya usa `IngredientsTable.tsx`) y se separó el layout en dos ramas — desktop sigue con el `Sider` fijo de siempre; mobile reemplaza el sidebar por un `Header` (nombre del negocio + botón de logout) más un `Menu mode="horizontal"` con los dos links, sin sidebar permanente.
  - `IngredientUsageTable.tsx`/`ProductionOutputTable.tsx`: padding del contenedor `p-6` → `p-3 md:p-6`; `Table` con `scroll={{ x: 480 }}` (evita que las columnas se aplasten en pantallas muy angostas) y paginación simplificada (`simple: isMobile`, con flechas en vez de números de página) en mobile.
  - No se rehízo la tabla como lista de cards (patrón de `IngredientsTable.tsx` en mobile) — el reporte del usuario apuntaba al sidebar como causa raíz; con el scroll horizontal ya no se desconfigura, y son pocas columnas.
  - `tsc --noEmit` limpio en frontend.
- `frontend/src/features/production/`: `components/IngredientUsageForm.tsx` (selector de insumo vía `IngredientsService` ya existente + cantidad + notas + tabla de los últimos registros), `ProductionOutputForm.tsx` (selector de producto vía `GET /products/all-variants`, ya accesible para cualquier rol autenticado, sin endpoint nuevo), `hooks/useIngredientUsage.ts` / `useProductionOutput.ts` (fetch de opciones + submit + refresh de la tabla), `services/production.service.ts`, `types/production.types.ts`.
- `frontend/src/app/login/page.tsx`: `ROLE_REDIRECTS.produccion = "/produccion"`.
- `frontend/src/lib/api-endpoints.ts`: nuevo bloque `production.{ingredientUsage, output}`.
- Traducciones: namespace `production.*` en `es.json`/`en.json`.
- `tsc --noEmit` limpio en frontend.

### Cómo probarla

Login con el usuario `produccion` → debe caer en `/produccion`, sin menú ni acceso a otras secciones. Registrar un insumo y una producción desde los formularios → deben aparecer en la tabla de abajo de cada uno sin recargar la página, y confirmar en DB (`production_ingredient_logs`/`production_output_logs`). Navegar a `/pos` o `/dashboard` a mano → debe expulsar a `/login`. Como superadmin, apagar el módulo "Producción" de ese negocio → recargar `/produccion` (o volver a loguear) → debe expulsar a `/login`.

---

## Fase 5 — Reportes: pestaña "Producción" ✅

### Qué entrega

Pestaña "Producción" en Reportes (solo visible si el negocio tiene el módulo habilitado), con dos tablas: insumos usados agregados por insumo y producción agregada por variante, en el rango de fechas seleccionado. Sin selector de sucursal — se aclara en un `Alert` arriba de las tablas.

### Backend

- `backend/src/reports/reports.service.ts`: `getProduction(query, user)` — trae `productionIngredientLog`/`productionOutputLog` del `business_id` del usuario con el mismo criterio de rango `from/to` que el resto de los reportes (sin rango explícito, acota a "hoy"), agrupa en memoria por `ingredient_id`/`variant_id` sumando `quantity`, ordena descendente. Reusa `ReportQueryDto` (el `branchId` que trae se ignora a propósito, documentado con un comentario).
- `backend/src/reports/reports.controller.ts`: `GET /reports/production`.
- `backend/src/reports/types/report-result.types.ts`: `ProductionIngredientSummary`/`ProductionOutputSummary`/`ProductionReportResult`.
- 2 tests nuevos en `reports.service.spec.ts` (agregación correcta + caso vacío). Suite completa del backend sigue en los mismos 12 fallos preexistentes (382 tests pasando, antes 380).

### Frontend

- `frontend/src/features/reports/hooks/useReportFilters.ts`: ahora también trae `enabled_modules` vía `getUserProfile()` (mismo patrón que `useUsers.ts`), expuesto como `enabledModules`.
- `frontend/src/features/reports/hooks/useProductionReport.ts` / `components/ProductionReportTable.tsx` (patrón de `useCashierReport.ts`/`CashierReportTable.tsx`, pero sin la vista mobile-cards — dos `Table` de AntD en `Card`s lado a lado).
- `frontend/src/features/reports/hooks/useReportsPage.ts`: agrega `production` al hook agregador, dispara `production.fetch()` cuando `activeTab === "produccion"`.
- `frontend/src/app/(admin)/reports/page.tsx`: pestaña "Producción" agregada condicionalmente al array de `items` de `Tabs` solo si `filters.enabledModules.produccion` es `true`.
- `frontend/src/features/reports/services/reports.service.ts` / `types/reports.types.ts`: `fetchProductionReport()`, tipos `ProductionReport`/`ProductionIngredientSummary`/`ProductionOutputSummary`.
- `frontend/src/lib/api-endpoints.ts`: `reports.production(qs)`.
- Traducciones: `reports.tabs.production` + namespace `reports.production.*` (distinto del namespace `production.*` ya existente del panel operativo — no se pisan).
- `tsc --noEmit` limpio en frontend.

### Amendment — rediseño de UX (`ProductionReportTable.tsx`)

El usuario no estaba conforme con la primera versión (dos tablas lado a lado + un `Alert` grande aclarando lo de sucursal) y pidió explorar otra perspectiva de UX (`/design`). Se armó un canvas con 3 direcciones de mockup (datos de ejemplo, tokens reales de la app — acento `#f97316`, patrón de `Card`/`Table` de AntD) para elegir entre:
- **A** — KPIs arriba + listas rankeadas con barra de magnitud.
- **B** — vista de "balanza" con barras espejadas (insumos vs producción).
- **C** — subtabs Insumos/Producción + gráfico de barras horizontal + tabla de detalle.

El usuario eligió la **C**. Implementación final en `frontend/src/features/reports/components/ProductionReportTable.tsx`:
- Reemplaza los dos `Card`+`Table` lado a lado por un `Segmented` (AntD) para alternar entre "Insumos usados" y "Producción" — una vista a la vez, mejor también en mobile porque no reparte el ancho en dos columnas.
- El aviso de "no filtra por sucursal" pasa de `Alert` de ancho completo a un caption chico (ícono + texto de una línea) junto al `Segmented`. Texto acortado en `es.json`/`en.json` (`reports.production.branchNote`) para que entre en una línea: "Se filtra por fecha, no por sucursal (negocio completo)" — más corto que el original pero sigue aclarando que el filtro de fecha sí aplica (evita la confusión de la ronda anterior).
- Arriba de la tabla de detalle se agregó un panel de barras horizontales (ranking por cantidad, con la magnitud relativa al máximo de esa lista) — mismo criterio de "magnitud relativa" que se usó en los mockups; queda anotado que mezclar unidades distintas (kg/unidad) en una sola escala de barra es una simplificación visual, no una comparación literal.
- En mobile, cada fila del panel de barras apila el label arriba y la barra+valor abajo (`useIsMobile()`) en vez de la fila de 3 columnas fija de desktop.
- Sin cambios de backend ni de tipos (mismo `getProduction`/`ProductionReport` de antes).
- `tsc --noEmit` limpio en frontend.

### Cómo probarla

Con datos ya cargados en las Fases 3/4, como admin ir a Reportes → debe aparecer la pestaña "Producción" solo si el superadmin habilitó el módulo para el negocio. Filtrar por rango de fecha → confirmar que las tablas de "Insumos usados" y "Producción" coinciden con lo registrado (sumado, sin duplicar filas por insumo/variante repetido). En un negocio sin el módulo habilitado, la pestaña no debe aparecer.

---

## Fase 6 — Usuarios: UI del rol ✅

### Frontend

- `frontend/src/features/users/types/user.types.ts`: `UserRole += "produccion"`.
- `frontend/src/features/users/constants/user.constants.ts`: `getRoleOptions(t, enabledModules)` ahora recibe `enabledModules` y solo agrega la opción "Jefe de Producción" si `enabledModules.produccion` es `true`; `getRoleLabels`/`ROLE_COLORS` también actualizados (color `gold`).
- `frontend/src/features/users/components/UserModal.tsx`: recibe `enabledModules` como prop, lo pasa a `getRoleOptions`; el `Select` de sucursal se deshabilita para `admin` y `produccion` (antes solo `admin`).
- `frontend/src/features/users/hooks/useUsers.ts`: llama `getUserProfile()` (mismo patrón que `frontend/src/app/(admin)/layout.tsx`) para obtener `enabled_modules` del negocio y lo expone en el hook; `handleRoleChange` limpia `branch_id` también para `produccion`.
- `frontend/src/app/(admin)/users/page.tsx`: pasa `enabledModules` del hook al `UserModal`.
- `frontend/messages/es.json`/`en.json`: `users.roles.produccion`.

### Cómo probarla

Como admin de un negocio con el módulo habilitado, crear un usuario desde la UI de Usuarios (sin usar la API directamente como en la Fase 1) → debe verse la opción "Jefe de Producción" y el campo sucursal debe deshabilitarse solo al elegirla. En un negocio sin el módulo, la opción no debe aparecer en el selector.

---

## Fase 7 — Traducciones ✅

En paralelo a las Fases 4-6: `frontend/messages/es.json` y `en.json` — roles, reports (`reports.tabs.production`, `reports.production.*`), namespace `production.*` del panel operativo.

### Auditoría final

Repasando todo el feature buscando strings hardcodeados fuera de next-intl (`grep` de literales en mayúscula en `src/app/produccion`, `src/features/production`, `src/features/reports`):

- **Encontrado y corregido**: `useIngredientUsage.ts`/`useProductionOutput.ts` tenían los mensajes de `notification.success`/`notification.error` ("Registro actualizado", "Insumo registrado", etc.) hardcodeados en español, sin pasar por `useTranslations` — a diferencia de `useUsers.ts` (`users.toasts`), que sí sigue el patrón del proyecto. Se agregó el namespace `production.toasts.*` (es/en) y ambos hooks ahora usan `useTranslations("production.toasts")`.
- Revisado también `layout.tsx` del panel `/produccion` y `ProductionReportTable.tsx`/`useProductionReport.ts` (Fase 5) — ya estaban 100% traducidos, sin hallazgos.
- **`MODULE_LABELS`** en `frontend/src/features/businesses/constants/modules.constants.ts` (panel del superadmin, incluye el label de "Rol: Jefe de Producción...") queda **fuera de alcance a propósito**: es texto hardcodeado en español, pero así ya estaba el resto de esa constante antes de este feature (`kitchen`, `stock`, `employees`, etc.) — el panel superadmin en general no usa `next-intl` (verificado: ningún componente bajo `src/features/businesses`/`src/app/(superadmin)` salvo `BusinessesTable.tsx` lo usa). No se introduce inconsistencia nueva ni se expande el alcance de esta fase para internacionalizar un panel que nunca lo estuvo.
- `users.roles.produccion` ya estaba traducido en es/en desde la Fase 6.

---

## Fase 8 — Control de inventario: 3 switches generales (Configuración → Inventario) ✅

**Contexto real:** el cliente definió que el jefe de producción va a transferir productos elaborados a una sucursal puntual, y el admin quiere ver al final del día cuánto vendió cada cajero y cuánto de elaborado quedó — sin controlar stock de insumos en esta parte.

**Pivote de diseño durante la implementación**: el primer diseño (documentado más abajo en "Diseño descartado") era un campo `Product.deductStockOnSale` **por producto**. Tras implementarlo completo (backend + frontend + tests), el usuario aclaró que no era eso lo que pedía — su mental model era un control **general del negocio**, en Configuración → Inventario, no una opción dentro del formulario de cada producto ("primero analizaremos eso antes de tocar código"). Se descartó el campo por producto y se rediseñó como 3 switches de negocio, sub-controles del `use_stock` maestro que ya existía:

- **Reventa** (`stock_deduct_resale`, default `true`) — si la venta de un producto `resale` descuenta `branch_product_stock`. Sin cambio de comportamiento respecto a antes de este feature.
- **Insumos** (`stock_deduct_insumos`, default `true`) — si la venta de un producto `made` con receta cargada descuenta esos insumos. Sin cambio de comportamiento respecto a antes de este feature.
- **Elaboración propia por unidad transferida** (`stock_deduct_made_unit`, default `false`) — **solo visible/aplicable si el negocio tiene `enabled_modules.produccion`**. Si está activo, tiene prioridad sobre "Insumos": la venta de **cualquier** producto `made` descuenta 1 unidad del stock transferido a la sucursal (`branch_product_stock`), no la receta. El usuario confirmó que en su catálogo real todos los productos de elaboración propia van por transferencia de unidades (sin excepciones "a pedido"/receta), por eso un switch único de negocio alcanza — no hace falta granularidad por categoría o producto.
- Las 3 son sub-controles de `use_stock` (el master switch existente): si `use_stock` está apagado, ninguna de las 3 importa — la venta no descuenta nada de nada, como ya funcionaba.
- **Corte inmediato**: `stock_deduct_made_unit` se cruza en el momento de la venta/anulación con el `enabled_modules.produccion` vigente (`SettingsService.getStockControlFlags`) — si el superadmin apaga el módulo después de que el admin activó el switch, la venta vuelve a caer en insumos/nada automáticamente, sin que nadie tenga que tocar Configuración.

### Backend

- `backend/src/settings/settings.service.ts`: 3 claves nuevas en `SETTINGS_KEYS` (`stock_deduct_resale`, `stock_deduct_insumos`, `stock_deduct_made_unit`, todas filas `app_settings` normales — sin migración de schema). `getSettings()`/`updateSettings()` las incluyen igual que el resto. Nuevo `getStockControlFlags(user)` — lee las 3 y devuelve `{ resale, insumos, madeUnit }`, con `madeUnit = raw && user.enabled_modules.produccion` ya resuelto (el caller no necesita repetir ese cruce).
- `backend/src/settings/dto/update-settings.dto.ts` / `types/settings-result.types.ts`: += los 3 campos.
- `backend/src/orders/lib/order-stock.ts` (función pura, unit-tested): se elimina `StockItem.deduct_stock_on_sale` (ya no es por ítem) y se agrega el parámetro `flags: StockControlFlags` a `computeStockDeductions(items, recipesByVariant, orderType, flags)`. Lógica por ítem: `resale` respeta `flags.resale`; `made` con `flags.madeUnit` cae en la misma rama de descuento por unidad que reventa (prioridad sobre insumos); `made` sin `madeUnit` respeta `flags.insumos` (receta o nada).
- `backend/src/orders/orders.service.ts`: se elimina `effectiveDeductStockOnSale`. `create()`/`addItemsToOrder()` llaman `settingsService.getStockControlFlags(user)` una vez (solo si `useStock` es `true`) y arman `StockItem[]` sin el campo por ítem. `computeReversalDeductions(order, flags)` cambia de firma (recibía `user`, ahora recibe `flags` ya resueltos, calculados en `cancelOrder()` junto al resto).
- `backend/src/products/products.service.ts`: se elimina `resolveDeductStockOnSale` y todo uso de `deductStockOnSale` (create/update/duplicate/mapProduct/getDetail) — vuelve a ser exactamente el código de antes de este feature.
- `backend/prisma/schema.prisma`: se elimina `Product.deductStockOnSale` (columna agregada por el diseño descartado).
- `packages/shared/src/models/product.ts`: se elimina `Product.deduct_stock_on_sale`.
- Migraciones: `072_product_deduct_stock_on_sale.sql` (diseño descartado, agregaba la columna) queda documentada como superseded; `073_drop_product_deduct_stock_on_sale.sql` la revierte. Ninguna de las dos llegó a Supabase — ambas solo corrieron en el Postgres **local**, en orden.
- DTOs de producto (`create-product.dto.ts`/`update-product.dto.ts`) y `product-detail.types.ts`: se elimina `deduct_stock_on_sale?`.
- Tests: `order-stock.spec.ts` reescrito con `StockControlFlags` en vez de flag por ítem (agrega casos: "Insumos" apagado → made no deduce nada; `madeUnit` con prioridad sobre `insumos` cuando ambos están en `true`). `orders.service.spec.ts`/`products.service.spec.ts`: se sacan los tests del diseño por producto (rechazo/aceptación de `deduct_stock_on_sale` en `create`/`update`), se agregan 2 tests en `orders.service.spec.ts` sobre `getStockControlFlags` mockeado con `madeUnit: true`/`false`. `settings.service.spec.ts`: expectativa de `getSettings()` actualizada con los 3 campos nuevos.
- Sin regresiones: `tsc --noEmit` limpio en backend, suite completa en los mismos 5 fallos preexistentes de siempre (3 en `orders.service.spec.ts` — `addItemsToOrder`/`getPendingKitchenOrders`/`markReady`, código no tocado por este feature — y 2 en `products.service.spec.ts` — `getVariantsWithDetails`/`getPosCatalog` —, todos confirmados sin relación con este cambio vía `git diff HEAD`).

### Frontend

- `frontend/src/features/settings/`: `types/index.ts` (`AppSettings`) y `hooks/useSettings.ts` (defaults) += los 3 campos. `components/StockSettingsForm.tsx` recibe `enabledModules` como prop y muestra los 3 switches nuevos debajo del master `use_stock` (solo si está activo) — el tercero ("Elaboración propia por unidad transferida") solo se renderiza si `enabledModules.produccion`.
- `frontend/src/app/(admin)/settings/page.tsx`: pasa el `enabledModules` que ya resolvía (antes solo para ocultar/mostrar tabs) también como prop a `<StockSettingsForm>`.
- Se revierte por completo el trabajo del diseño descartado en `frontend/src/features/products/`: `Step1Data` sin `deduct_stock_on_sale`, `useProductForm.ts` sin el fetch de `enabledModules` (ya no hace falta ahí), `ProductFormPage.tsx`/`ProductStepGeneral.tsx` sin los 2 switches por producto ni el reset en el selector de tipo — el formulario de producto queda idéntico a como estaba antes de este feature.
- Traducciones: se sacan `products.form.deductStockOnSaleLabel/Extra` y `deductStockOnSaleResaleLabel/Extra`; se agregan `settings.stock.deductResaleLabel/Extra`, `deductInsumosLabel/Extra`, `deductMadeUnitLabel/Extra` (es/en).
- `tsc --noEmit` limpio en frontend.

### Cómo probarla

1. Configuración → Inventario, con `use_stock` activo: deben verse "Reventa" e "Insumos" (ambos ON por default) siempre; "Elaboración propia por unidad transferida" solo si el superadmin habilitó "Producción" para el negocio.
2. Con "Elaboración propia por unidad" apagado (default): vender un producto `made` con receta descuenta insumos como siempre; un producto `resale` descuenta stock de sucursal como siempre.
3. Activar "Elaboración propia por unidad" → vender cualquier producto `made` → confirmar que descuenta `branch_product_stock` (no insumos), incluso sin stock transferido todavía (queda en negativo/0 según el comportamiento ya existente de `create_order_atomic` — la Fase 10 resuelve cómo llenarlo).
4. Apagar el módulo "Producción" desde el superadmin (con el switch de negocio en `true`) → vender de nuevo → debe volver a descontar insumos por receta, sin tocar Configuración.
5. Apagar "Reventa" o "Insumos" → confirmar que las ventas de ese tipo dejan de descontar nada (y no rompen la venta).

### Diseño descartado — campo por producto (referencia histórica)

Primer intento, completo y funcional, pero no era lo que el cliente pedía: `Product.deductStockOnSale: Boolean`, uniforme para `resale`/`made`, editable por producto en su formulario, gateado por `enabled_modules.produccion` al activarlo en un `made`. Migración `072`, DTOs de producto, `resolveDeductStockOnSale` en `products.service.ts`, 2 switches mutuamente excluyentes en `ProductStepGeneral.tsx`. Se documenta acá solo como registro de qué se descartó y por qué (el usuario quería un control de negocio, no de catálogo) — el código real quedó revertido, ver secciones de arriba.

---

## Fase 10 — Transferencia bodega→sucursal para el jefe de producción ✅

### Qué entrega

El jefe de producción puede enviar unidades de un producto elaborado a una sucursal puntual, para que los cajeros de esa sucursal puedan venderlo — todo desde su propio panel `/produccion`, sin admin en el medio (confirmado con el usuario: "el mismo jefe de producción, en su mismo panel").

### Diseño

Reusa la infraestructura de stock de productos terminados que ya existe para reventa (`WarehouseProductStock`/`BranchProductStock`/`WarehouseProductMovement`/`ProductStockMovement`, `backend/src/warehouse/warehouse-product.service.ts`) en vez de construir un mecanismo nuevo:

- `ProductionService.logOutput()` (registrar producción, ya existente) — cuando el negocio tiene el switch de negocio "Elaboración propia por unidad transferida" activo (Fase 8, `stock_deduct_made_unit`, ya resuelto con el cruce del módulo vía `SettingsService.getStockControlFlags`), además de crear la fila en `production_output_logs` (bitácora, sin cambios), suma la cantidad a `WarehouseProductStock` (upsert por `businessId`+`variantId`, movimiento `type: 'compra'` — mismo valor que ya acepta el CHECK constraint de `warehouse_product_movements`, cumple el mismo rol que una "compra" para productos de reventa). `updateOutput`/`deleteOutput` reconcilian la diferencia contra la bodega (incluyendo el caso de cambiar el producto del registro), rechazando con 400 si dejaría el saldo en bodega negativo (ya se transfirió a una sucursal más de lo que quedaría el registro corregido).
- Transferencia: el endpoint `POST /warehouse/product-transfer` ya existía y ya funcionaba para mover unidades de `WarehouseProductStock` a `BranchProductStock` de una sucursal — **hallazgo confirmado y corregido**: no tenía ningún `@Roles(...)` en los 5 endpoints `product-*` de `WarehouseController` (solo `JwtAuthGuard` a nivel de clase), o sea que cualquier rol autenticado ya podía llamarlos. Se agregó `@Roles('admin', 'produccion')` a los 5.
- **Hallazgo adicional durante la implementación**: `BranchesService.list()` filtraba `id: user.branch_id ?? ''` para cualquier rol no-admin — el jefe de producción no tiene sucursal propia (igual que admin), así que veía la lista de sucursales vacía y no podía elegir destino. Se agregó `produccion` a la misma excepción que ya tenía `admin` (ve todas las sucursales del negocio).
- `WarehouseProductService.list()` gana un parámetro opcional `productType` (mismo patrón que `ProductsService.listAllVariants`, Fase 4) para que la pantalla nueva solo traiga saldo de productos `made` — el jefe de producción no necesita ver bodega de reventa.
- Frontend: nueva pantalla en `/produccion` ("Transferir", `transferencia/page.tsx`) — `ProductionTransferForm.tsx` + `useProductionTransfer.ts`: selector de producto (solo `made` con saldo en bodega > 0, vía `GET /warehouse/product-stock?productType=made`), selector de sucursal (`BranchesService.getBranches()`, reusado tal cual de la feature `branches`), cantidad, y ejecuta la transferencia contra el mismo `POST /warehouse/product-transfer` que ya usa el admin — sin duplicar el endpoint. Tercer ítem de menú en el sidebar/menú móvil del layout de `/produccion`.
- Traducciones: `production.menu.transferencia`, namespace `production.transfer.*`, `production.toasts.transferDone/transferError` (es/en).
- Tests nuevos: `production.service.spec.ts` (8 — alta/ajuste/reversión de bodega en `logOutput`/`updateOutput`/`deleteOutput`, con y sin el switch activo, incluyendo el rechazo por saldo insuficiente), `branches.service.spec.ts` (1 — `produccion` ve todas las sucursales). `tsc --noEmit` limpio en ambos paquetes; suite completa del backend en los mismos 5 fallos preexistentes de siempre (410 tests pasando, antes 401).

### Cómo probarla

Con el switch de negocio "Elaboración propia por unidad transferida" activo (Fase 8) y un usuario `produccion`: registrar producción de un producto `made` (ej. 40 unidades) en "Producción" → ir a "Transferir" (mismo panel) → el producto debe aparecer con saldo 40 → elegir una sucursal y transferir 15 → confirmar `BranchProductStock` de esa sucursal en 15 y bodega en 25 → vender una unidad en el POS de esa sucursal → confirmar que baja a 14 sin tocar insumos. Editar el registro de producción original bajando la cantidad a menos de lo ya transferido → debe rechazar con un mensaje claro en vez de dejar la bodega en negativo.

---

## Fase 11 — Reportes: stock de elaborados restante en "Por cajero" ✅

### Qué entrega

El admin, filtrando Reportes por una sucursal puntual, ve junto en la misma pestaña "Por cajero": cuánto vendió cada cajero (ya existía) y cuánto stock queda de cada producto elaborado trackeado en esa sucursal (nuevo) — el "arqueo" pedido por el cliente.

### Diseño

- `backend/src/reports/reports.service.ts`: `getCashiers` cambia de firma de retorno — de `CashierReportResult[]` a `{ cashiers: CashierReportResult[]; branch_stock: BranchElaboratedStockRow[] }`. `branch_stock` se resuelve en un método privado nuevo, `getBranchElaboratedStock`, que devuelve `[]` salvo que se cumplan las dos condiciones a la vez: `query.branchId` es una sucursal puntual (no "todas" — el frontend ya omite el parámetro para "todas", así que `branchId` ausente = vacío a propósito) **y** el negocio tiene "Elaboración propia por unidad transferida" activo (`SettingsService.getStockControlFlags`, Fase 8 — ya resuelve el cruce con `enabled_modules.produccion`). Con ambas, consulta `branch_product_stock` filtrado a `variant.product.productType = 'made'` en esa sucursal (incluye filas en 0 — "se vendió todo" es información válida para el arqueo).
- **Cada fila trae `quantity` (restante) y `sold_quantity` (vendido en el mismo período/sucursal filtrados)** — el pedido original del cliente era ver las dos cosas juntas ("cuánto vendió cada cajero y cuánto de productos elaborado quedaron"), no solo el restante. `sold_quantity` se calcula acumulando `item.qty` por variante en la misma pasada que ya arma `cashierMap` (mismo `orders.findMany`, sin fetch extra) — es la suma de TODOS los cajeros de esa sucursal en el período, no de uno solo.
- `backend/src/reports/reports.module.ts`: importa `SettingsModule` (nueva dependencia del servicio).
- `backend/src/reports/types/report-result.types.ts`: nuevos `BranchElaboratedStockRow` (con `sold_quantity`)/`CashierReportListResult`.
- Frontend: `reports.service.ts`/`useCashierReport.ts`/`reports.types.ts` — `fetchCashierReports` devuelve `{ cashiers, branchStock }` en vez de un array plano. `CashierReportTable.tsx` — nueva sección (`Card`+`Table`, ícono de bodega) arriba del desglose por cajero, columnas "Producto" / "Vendido" / "Restante", que solo se renderiza si `branchStock.length > 0` (el propio backend ya la deja vacía en "todas las sucursales" o con el switch apagado, así que el componente no repite esa lógica de gating).
- Traducciones: `reports.branchStock.title`/`sold`/`remaining` (es/en) — reusa `reports.columns.product` ya existente para la columna de producto.
- Tests nuevos: `reports.service.spec.ts` (4 — vacío sin `branchId`, vacío con `branchId` pero switch apagado, filas con `quantity`+`sold_quantity=0` sin ventas, `sold_quantity` sumando ventas de varios cajeros). `tsc --noEmit` limpio en ambos paquetes; suite completa del backend en los mismos 5 fallos preexistentes de siempre (414 tests pasando, antes 410).

### Cómo probarla

Con datos de las Fases 8/10 ya cargados (switch "Elaboración propia por unidad" activo, stock ya transferido a una sucursal, y alguna venta hecha en el POS de esa sucursal): Reportes → Por cajero, filtrando por esa sucursal → debe aparecer arriba del desglose por cajero una tarjeta "Stock de elaborados en esta sucursal" con columnas Vendido/Restante por producto — los dos números tienen que sumar la cantidad total que se transfirió a esa sucursal. Cambiando el filtro a "Todas las sucursales", esa tarjeta debe desaparecer. En un negocio sin el switch activo, tampoco debe aparecer nunca, aunque se filtre por una sucursal puntual.

---

## Fase 9 — Cierre

- `tsc --noEmit` en backend y frontend tras todos los cambios.
- Actualizar `docs/database/schema-base.sql` y `docs/database/migrations/PENDING.md` con el estado final de las migraciones 069/070 aplicadas.
- Actualizar el "Estado" en `feature.md` y esta tabla resumen.

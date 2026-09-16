# Jefe de Producción (reunión cliente)

## Estado

**En progreso, feature funcionalmente completa.** Fases 1-8 y 10-11 hechas (rol y feature flag por negocio, bitácora, backend del módulo `production`, panel `/produccion`, reportes, UI de Usuarios, traducciones, control de inventario — 3 switches generales en Configuración → Inventario, transferencia bodega→sucursal, reporte de arqueo en "Por cajero"). Solo queda la Fase 9 (cierre): actualizar `schema-base.sql`/`PENDING.md` recién cuando las migraciones (069-073, hoy solo en el Postgres local) se apliquen en Supabase real. Ver `roadmap-fases.md` para el detalle fase por fase.

## Objetivo

Un rol nuevo, **jefe de producción**, para la persona que elabora productos horneados (alfajores, rollos de queso, rollos de canela, buñuelos) y necesita, sin acceso a nada más del sistema, registrar diariamente:
1. Qué insumos necesitó/usó para elaborar, y en qué cantidad (ej. "5 kg de harina").
2. Qué cantidad de cada producto elaboró (ej. "40 alfajores, 50 buñuelos").

El admin/superadmin debe poder ver esos registros en Reportes, para comparar producción vs. ventas.

Incluye además un control de inventario relacionado (3 switches generales en Configuración → Inventario), que nace del mismo requerimiento pero es independiente del rol en sí.

## Contexto

Salió de una reunión con el cliente. El sistema ya soporta roles restringidos (`cajero` ya funciona: usuario con sucursal asignada, entra por el mismo link de login, el sistema lo redirige automáticamente a su panel sin acceso a nada más). El cliente pidió replicar ese patrón para un segundo rol, jefe de producción, y quiere probarlo cuanto antes con un usuario real.

## Actores

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Superadmin** | Dueño del SaaS | Decide, por negocio (tenant), si el rol `produccion` está habilitado — vía el mecanismo `enabledModules` que ya existe para otras features (stock, kitchen, telegram, etc.). No es autoservicio del negocio. |
| **Admin** | Dueño/encargado del negocio (tenant) | Si el superadmin habilitó el módulo, puede crear usuarios con rol `produccion` (sin asignarles sucursal). Ve los reportes de producción. |
| **Jefe de producción** *(nuevo)* | Persona que elabora productos horneados | Login individual, sin sucursal asignada. Entra directo a su panel (`/produccion`), sin ver nada más del sistema. Registra insumos usados y cantidad producida. No ve ventas, no ve otros usuarios, no ve reportes. |

## Decisiones confirmadas con el cliente/usuario del proyecto

- **Registro manual e independiente**: no hay descuento automático vía receta/BOM. El jefe de producción ingresa por un lado el consumo de insumos y por otro la cantidad producida, sin relación calculada entre ambos.
- **Sin sucursal, por ahora**: el usuario con rol `produccion` no se asigna a ninguna sucursal al crearse (a diferencia de cajero/cocinero/mesero). Sus registros tampoco llevan sucursal en esta primera versión — son una **bitácora a nivel de negocio**, no un movimiento de stock de una sucursal concreta.
- **Cómo y cuándo esos productos/insumos se traducen en stock de una sucursal específica queda explícitamente abierto** para una fase futura (transferencia manual desde bodega por el admin, o que el propio jefe de producción la haga más adelante). El diseño actual no debe asumir ni bloquear ninguna de esas opciones.
- **El superadmin controla, por negocio, si el rol está disponible** — no el admin del propio negocio. Distintos negocios del SaaS necesitan distintos conjuntos de roles habilitados (ej. negocio X solo cajero+mesero, negocio Y cajero+jefe de producción); es una decisión de provisioning del dueño del SaaS.
- **Esto se generalizó a TODOS los roles, no solo `produccion`** (decisión del usuario tras ver la Fase 1 original): el superadmin selecciona, por negocio, cuáles de los 5 roles (`admin`, `cajero`, `cocinero`, `mesero`, `produccion`) puede usar ese negocio — sin excepción, incluyendo `admin`/`cajero`. El admin del negocio solo ve en Usuarios los roles que el superadmin le habilitó. Ver `ROLE_MODULE_MAP` en `packages/shared/src/constants/business-modules.ts`.
- El set de roles del sistema sigue siendo **fijo y definido en código** (agregar un rol nuevo en el futuro sigue requiriendo desarrollo) — lo único dinámico es si un negocio concreto puede usar `produccion` o no. Se descartó explícitamente un motor de permisos/RBAC totalmente dinámico (roles inventados desde la UI): mucho mayor esfuerzo y riesgo de seguridad que lo pedido.

## Diseño técnico

- **Slug del rol**: `produccion` (una palabra, sin tilde — consistente con `cajero`/`cocinero`/`mesero`).
- **No se reutilizan las tablas de stock por sucursal** (`branch_stock`, `stock_movements`, `branch_product_stock`, `product_stock_movements`) — exigen `branch_id`, que estos registros no tienen todavía. En su lugar, dos tablas nuevas y simples, a nivel de negocio, que funcionan como bitácora (no afectan ningún stock existente):
  - `production_ingredient_logs` — `id, business_id, ingredient_id, quantity, notes?, created_by, created_at`.
  - `production_output_logs` — `id, business_id, variant_id, quantity, notes?, created_by, created_at`.
  - El día que se decida cómo mapear esto a inventario de una sucursal, esa lógica se construye como una fase aparte que lea estos logs.
- Como consecuencia, el riesgo de "doble descuento" (producción vs. venta con receta) se reduce: el registro del jefe de producción ya no toca el stock real. El control de inventario (switches generales) sigue siendo útil por sí mismo, pero deja de ser la solución a un doble descuento literal de stock.
- **Control de disponibilidad del rol — se reusa `Business.enabledModules`** (`backend/prisma/schema.prisma`, columna JSON `enabled_modules`, tipado en `packages/shared/src/constants/business-modules.ts`). Se agrega una clave nueva `produccion: boolean` (default `false`), igual que `stock`, `kitchen`, `mesero`, etc.
- **`ROLE_MODULE_MAP`** (`packages/shared/src/constants/business-modules.ts`) mapea cada rol a su clave de `enabledModules`: `admin→admin`, `cajero→cajero` (claves nuevas, default `true` para no romper negocios existentes), `cocinero→kitchen`, `mesero→mesero` (reusan módulos ya existentes), `produccion→produccion`. El superadmin tilda estos checkboxes desde el panel de negocios (`frontend/src/features/businesses/components/BusinessModal.tsx` / `BusinessEditModal.tsx`), agrupados visualmente en "Roles disponibles" separado de "Otros módulos habilitados" (`ROLE_MODULE_KEYS`/`FEATURE_MODULE_KEYS` en `frontend/src/features/businesses/constants/modules.constants.ts`).
- Backend (`UsersService.assertRoleAllowed`) y frontend (`getRoleOptions`) usan el mismo `ROLE_MODULE_MAP` para, respectivamente, rechazar con 400 y ocultar del selector cualquier rol que el negocio no tenga habilitado — no solo `produccion`.
- **Enforcement server-side del módulo** (no solo ocultar UI): se agrega `enabled_modules: EnabledModules` a `CurrentUserPayload` (`backend/src/auth/types/jwt.types.ts`), poblado en `current-user.mapper.ts` desde `profile.business.enabledModules` (que `JwtStrategy.validate()` ya trae en cada request). Así, si el superadmin apaga el módulo, el corte de acceso es inmediato en el siguiente request — mismo comportamiento que ya existe para negocio suspendido/usuario baneado.

### Backend

1. **Migración** `docs/database/migrations/069_production_role.sql`: agregar `'produccion'` a `profiles_role_check` (Fase 1); crear `production_ingredient_logs`/`production_output_logs` (Fase 2).
2. **DTOs de usuarios** (`create-user.dto.ts`/`update-user.dto.ts`): agregar `'produccion'` al `@IsIn([...])`, sin exigir `branch_id`. `users.service.ts` valida `enabled_modules.produccion` al crear/editar.
3. **`business-modules.ts`**: agregar `produccion` a `BUSINESS_MODULE_KEYS`/`EnabledModules`/`DEFAULT_ENABLED_MODULES`.
4. **`CurrentUserPayload`** += `enabled_modules`.
5. **Módulo `backend/src/production/`**: `logIngredientUsage`/`logOutput`/`listIngredientUsage`/`listOutput`, `@Roles('produccion','admin')`, valida `enabled_modules.produccion` en cada request.
6. **Reportes**: `GET /reports/production` — agrupado por producto/insumo, sin filtro de sucursal (los logs no la tienen).

### Frontend

1. **Ruta `/produccion`**: layout guard (`role === "produccion" || "admin"` y `enabled_modules.produccion`).
2. **Feature `frontend/src/features/production/`**: formularios de insumo usado y producción, sin selector de sucursal.
3. **Roles y login**: `UserRole += "produccion"`, `ROLE_REDIRECTS.produccion = "/produccion"`.
4. **Usuarios**: opción de rol condicionada a `enabled_modules.produccion`; campo sucursal no obligatorio/no visible para este rol.
5. **Panel superadmin**: checkbox "Producción" en `BusinessModal`/`BusinessEditModal`.
6. **Reportes**: pestaña "Producción", solo filtro de fecha (sin sucursal).

### Control de inventario — 3 switches generales en Configuración → Inventario ✅

**Decisión final del cliente**: el jefe de producción va a transferir productos elaborados a una sucursal puntual, y el admin quiere ver al cierre del día cuánto vendió cada cajero y cuánto de elaborado quedó — sin controlar stock de insumos en esa parte. El diseño pasó por un pivote: el primer intento (`Product.deductStockOnSale` por producto) quedó descartado porque el cliente pedía un control **general del negocio** en Configuración → Inventario, no una opción por producto — ver `roadmap-fases.md`, Fase 8, para el detalle de ambos diseños.

- **3 switches de negocio** (`app_settings`, sub-controles del `use_stock` maestro existente):
  - **Reventa** (`stock_deduct_resale`, default `true`) — descuento de `branch_product_stock` al vender un `resale`.
  - **Insumos** (`stock_deduct_insumos`, default `true`) — descuento de la receta al vender un `made`.
  - **Elaboración propia por unidad transferida** (`stock_deduct_made_unit`, default `false`) — solo visible/aplicable con `enabled_modules.produccion`. Activo, tiene prioridad sobre "Insumos": cualquier `made` descuenta 1 unidad de `branch_product_stock` en vez de receta.
- **Gateado por el rol**: `stock_deduct_made_unit` solo cuenta si el negocio tiene `enabled_modules.produccion` — corte inmediato si el superadmin apaga el módulo después (vuelve a insumos/nada sin tocar Configuración).
- **Backend**: `SettingsService.getStockControlFlags(user)` (nuevo) resuelve los 3 flags con el cruce del módulo ya aplicado + `order-stock.ts` (`computeStockDeductions`, función pura y unit-tested, ahora recibe `StockControlFlags` en vez de un flag por ítem) + `orders.service.ts` (llama `getStockControlFlags` una vez por operación: venta, agregar items, reversión al anular).
- **Frontend**: 3 switches en `StockSettingsForm.tsx` (Configuración → Inventario), el tercero condicionado a `enabledModules.produccion`.
- Ver `roadmap-fases.md`, Fase 8 (hecha), Fase 10 (transferencia bodega→sucursal, hecha) y Fase 11 (reporte de arqueo, pendiente) para el detalle completo.

## Verificación end-to-end (del feature completo)

1. Superadmin habilita "Producción" para un negocio de prueba.
2. Admin crea un usuario `produccion` sin sucursal — solo posible porque el módulo está habilitado.
3. Login → redirige a `/produccion`; otras rutas protegidas expulsan a `/login`.
4. Registrar insumo usado → fila en `production_ingredient_logs`, sin tocar `branch_stock`.
5. Registrar producción → fila en `production_output_logs`, sin tocar `branch_product_stock`.
6. Superadmin apaga el módulo → corte de acceso inmediato.
7. Negocio sin el módulo habilitado → no se puede crear el usuario (ni UI ni API forzada).
8. Reportes → pestaña "Producción", filtro de fecha, ve los registros agregados.
9. Switch "Insumos" desactivado en Configuración → Inventario → vender un producto `made` con receta no descuenta insumos.

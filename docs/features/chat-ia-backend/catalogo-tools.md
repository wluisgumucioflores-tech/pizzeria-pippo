# Catálogo de tools — ai-orchestrator

Estado de las `@Tool` expuestas al chat por dominio (`services/ai-orchestrator/src/main/java/com/saas/aiorchestrator/agents/`). Se actualiza cada vez que se agrega o cambia una tool — es la referencia rápida de "qué puede hacer el agente hoy" sin tener que leer el código.

Arquitectura: single-agent-many-tools (un solo `ChatClient` por turno, todas las tools del rol disponibles a la vez). Detalle de por qué no multiagente todavía: ver `plan-desarrollo-spring-ai.md` y la sección de evaluación de arquitectura más abajo.

## Convenciones

- **Rol**: quién ve la tool en `AgentRegistry` (`admin` = solo admin, `todos` = cualquier rol autenticado).
- **Tipo**: `read` (GET) o `write` (POST/PATCH/etc.).
- **Estado**: `✅ activo` | `⏸️ pausado` | `🚧 en progreso`.
- **Plan**: para las tools de escritura de `stock`, además del rol se necesita que el plan del negocio (`ai_chat_plans.limits.allowed_write_domains`, gestionado por el superadmin en `/ai-chat-plans`) incluya ese dominio. El resto (incluido `branches`) no está gateado por plan, solo por rol (ver nota de alcance más abajo).

---

## Contexto de sucursal pre-resuelto

Decisión (2026-09): para que el modelo no tenga que llamar `getBranches` ni preguntar "¿qué sucursal?" en cada consulta de reportes/stock, el `branchId` efectivo se resuelve **antes** de llegar al orquestador y se inyecta en el system prompt (mismo mecanismo que `buildDateContext` para "hoy es tal fecha").

- **Dónde se resuelve**: `AiChatProxyService.resolveEffectiveBranch` (NestJS), reusando `BranchesService.list()` — que ya scopea por rol igual que la RLS real (admin ve todas, cajero/mesero solo la propia).
  - Si el usuario solo ve **una** sucursal (cajero/mesero con `branch_id` fijo, o negocio con una sola sucursal) → esa se usa siempre, sin UI ni pregunta.
  - Si ve **varias** (admin en negocio multi-sucursal) → el widget (`AiChatWidget.tsx`) muestra un selector (sucursal específica o "Todas"); por defecto arranca en "Todas" hasta que el admin elige.
- **Cómo llega al orquestador**: `ToolChatRequest.branchId`/`branchName` (nuevos campos) → `ChatOrchestrationService.buildBranchContext(...)` agrega una línea al system prompt (`chat.branch-context` en `messages*.properties`) diciéndole al modelo que use ese `branchId` en las tools que lo acepten, salvo que el usuario pida explícitamente otra sucursal o "todas".
- **No reemplaza `getBranches`** — sigue existiendo para cuando el usuario pide una sucursal distinta a la pre-seleccionada, o para tools de escritura que necesitan resolver una sucursal por nombre (`createProduct`, `createPromotion`).

---

## sales (`agents/sales/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getSalesReport` | read | todos | ✅ activo | Total vendido, cantidad de órdenes, ticket promedio. |
| `getTopProductsReport` | read | todos | ✅ activo | Productos más vendidos en un rango de fechas. |
| `getDailyReport` | read | todos | ✅ activo | Ventas día a día. |
| `getCashiersReport` | read | todos | ✅ activo | Ventas desglosadas por cajero. Sin fechas → hoy. |
| `getOrdersReport` | read | todos | ✅ activo | Listado de órdenes, paginado. |

## stock (`agents/stock/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getStock` | read | todos | ✅ activo | Stock actual de ingredientes, paginado. |
| `getStockAlerts` | read | todos | ✅ activo | Alertas de stock bajo/agotado. |
| `getStockMovements` | read | todos | ✅ activo | Historial de movimientos (compras, ventas, ajustes, reversas), paginado. |
| `purchaseStock` | write | **admin** + plan `stock` | ✅ activo | Registra una compra — suma cantidad al stock existente de un ingrediente en una sucursal. Resuelve `ingredientId`/unidad con `getStock` antes de llamar. `POST /stock/purchase`. |
| `adjustStock` | write | **admin** + plan `stock` | ✅ activo | Ajusta el stock de un ingrediente a una cantidad real contada (sobrescribe, no suma) — mermas, conteos físicos. `POST /stock/adjust`. |

## branches (`agents/branches/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getBranches` | read | todos | ✅ activo | Listado de sucursales (id + nombre). Usada por las tools de escritura para resolver sucursal por nombre. |
| `createBranch` | write | **admin** | ✅ activo | Crea sucursal (`name`, `address`/`phone`/`expectedStartTime` opcionales). No gateada por plan — la UI tampoco limita cuántas sucursales puede crear un admin. `POST /branches`. |

## ingredients (`agents/ingredients/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getIngredients` | read | todos | ✅ activo | Catálogo de insumos, paginado. Distinto de `getStock`: este lista el maestro de insumos (exista o no stock cargado en alguna sucursal). |
| `createIngredient` | write | **admin** | ✅ activo | Crea un insumo (`name`, `unit`, `isSharedUse` opcional). No gateada por plan, mismo criterio que `branches`/`categories`. `POST /ingredients`. |

## variantTypes (`agents/varianttypes/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getVariantTypes` | read | todos | ✅ activo | Catálogo de nombres de tamaño/variante (ej. "Chica", "Mediana", "Familiar") disponibles para armar variantes de producto. Distinto de la variante de producto en sí (esa tiene precio y se crea con `createProduct`). |
| `createVariantType` | write | **admin** | ✅ activo | Crea un nombre de tamaño/variante nuevo (`name`). No gateada por plan, mismo criterio que `branches`/`categories`/`ingredients`. `POST /variant-types`. |

## categories (`agents/categories/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getCategories` | read | todos | ✅ activo | Listado de categorías de producto. |
| `createCategory` | write | **admin** | ✅ activo | Crea categoría (`name`, `isPizza` opcional). `POST /categories`. |

## products (`agents/products/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getProducts` | read | todos | ✅ activo | Catálogo de productos, paginado. Solo activos por defecto. |
| `createProduct` | write | **admin** | ✅ activo | Crea producto con variantes y precios. Replica el flujo de la UI: resuelve categoría (`getCategories`), pregunta tipo de producto si no es claro (`made`/`resale`), completa precio por sucursal faltante con el precio base (`fillMissingBranchPrices`), no soporta imagen. Si es `made`, agrega nota recordando cargar la receta. `POST /products`. |

## promotions (`agents/promotions/`)

| Tool | Tipo | Rol | Estado | Descripción |
|---|---|---|---|---|
| `getPromotions` | read | todos | ✅ activo | Promociones del negocio (filtro por sucursal/fecha/activas). |
| `createPromotion` | write | **admin** | ✅ activo | Crea promoción. Una sola tool genérica para los 3 tipos (`BUY_X_GET_Y`, `PERCENTAGE`, `COMBO`) — el significado de cada campo de `rules` depende del tipo, igual que `PromotionRules.tsx` en el panel. Reglas de negocio embebidas en la descripción del tool: fechas/días obligatorios sin default (pregunta si faltan); `BUY_X_GET_Y` no tiene wildcard "todos los productos" (pregunta producto específico); `PERCENTAGE` con `variantId` vacío = todos los productos; `COMBO` con `comboPrice` solo en la primera regla, slots específicos (`variantId`) o flexibles (`category`/`variantSize`). `POST /promotions`. |

---

## Gating por plan (`stock`)

Decisión (2026-09): la tool de escritura de `stock` es más sensible que el resto (el AI escribe sin ver el contador actual en pantalla como lo ve un humano llenando el formulario, y afecta inventario/costos), así que además del rol admin necesita que el plan del negocio la habilite explícitamente.

`branches` se evaluó para el mismo mecanismo pero se descartó: el panel admin no limita por plan cuántas sucursales puede crear un negocio, así que gatear `createBranch` por plan solo en el chat creaba una asimetría sin justificación — se dejó como `role=admin` únicamente, igual que categorías/productos/promociones.

- **Dónde vive**: `ai_chat_plans.limits.allowed_write_domains` (array de strings, hoy solo `["stock"]` es válido), mismo patrón JSON que `model_id` (`062_ai_chat_plans_model_id.sql`). Gestionado por el superadmin en `/ai-chat-plans` (`AiChatPlanModal.tsx`). Ver `066_ai_chat_plans_allowed_write_domains.sql`.
- **Cómo llega al orquestador**: `GET /ai-chat/runtime-config` (NestJS) suma el campo `allowedWriteDomains` a la respuesta, resuelto desde el plan del negocio (`AiModelsService.getRuntimeConfigForBusiness`). `RuntimeConfig.java` lo recibe y `ChatOrchestrationService` lo pasa como `Set<String>` a `AgentRegistry.toolsFor(...)`.
- **Cómo se aplica**: `Agent.tools(businessId, role, allowedWriteDomains)` — todos los agentes reciben el set (cambio de firma en los 6, para no tener dos formas de definir `Agent`), pero solo `StockAgent` lo chequea (`role == "admin" && allowedWriteDomains.contains("stock")`). El resto lo ignora a propósito — el parámetro queda ahí como seam para el próximo dominio que sí necesite este nivel de gating, no cada uno inventa su propio mecanismo.
- **Default**: plan sin la key o con array vacío = sin escritura en `stock`, aunque el usuario sea admin.

## Gotcha: el system prompt también hay que actualizarlo

El texto base (`ai_prompts` en Supabase, ver `docs/database/migrations/059_ai_prompts.sql`) se escribió cuando el orquestador era solo-lectura y decía explícitamente "no podés crear/editar/borrar nada". El modelo lo respetaba al pie de la letra y rechazaba usar `createCategory`/`createProduct` aunque la tool ya estuviera disponible — encontrado al probar `createPromotion` (ver `065_ai_prompts_enable_write_actions.sql`, que lo corrige).

**Al agregar la primera tool de escritura de un negocio/capacidad nueva, verificar que el system prompt no la esté bloqueando por texto** — el registro de la tool en `AgentRegistry` no alcanza si el prompt le dice al modelo que no puede escribir.

## Pendiente / explícitamente pausado

- **Updates/deletes** — ninguna tool de escritura soporta editar ni eliminar todavía (categorías, productos, promociones). Solo creación. No planificado hasta que se pida.
- **Recetas de producto** (`made`) — v1 no crea receta desde el chat; solo deja la nota de recordatorio en la respuesta.

## Evaluación de arquitectura: ¿multiagente?

Decisión vigente (2026-09): **no todavía**. Se preparó la base para migrar barato el día que haga falta (paquetes por dominio en `agents/`, método `runTurn()` reusable en `ChatOrchestrationService`), pero no se creó ningún Supervisor/Router real — hoy es un solo `ChatClient` con las tools del rol.

Triggers concretos para reconsiderar (ninguno presente hoy, con 22 tools totales):
1. El catálogo total de tools se acerca a ~25-30+ (el modelo empieza a confundirse eligiendo cuál usar).
2. Necesidad real de un modelo distinto por dominio (hoy el modelo se resuelve por plan del negocio, no por dominio).
3. El system prompt compartido crece tanto que instrucciones de un dominio interfieren con otro.
4. Preguntas que requieren coordinar varios dominios en un solo turno (ej. "creá una promo 2x1 para el producto más vendido del mes" → sales + products + promotions).

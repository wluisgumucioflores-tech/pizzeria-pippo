# mcp-saas — servidor MCP genérico sobre el backend de Pippo

## Estado

**No implementado.** En fase de diseño, plan aprobado. Este documento es la referencia a leer antes de tocar cualquier módulo relacionado con `services/mcp-saas`, `backend/src/mcp/`, o el flag `enabledModules.mcpSaas`.

## Objetivo

Exponer datos reales del negocio (ventas, stock, pedidos, productos) a través del protocolo MCP (Model Context Protocol), para que Claude u otras apps externas puedan consultarlos sin pasar por el panel admin. No es una integración puntual para Pizzería Pippo: **mcp-saas es un servidor MCP genérico** — toma el spec OpenAPI + un allowlist de cualquier backend REST y lo convierte en tools MCP. Pippo es el primer tenant configurado, no un caso hardcodeado en el código.

## Contexto

El backend de Pippo (NestJS, ~22 controllers, JWT + roles, multi-tenant por `business_id`) no tenía documentación OpenAPI. Como paso previo (rama `feature/mcp-server`) se agregó `@nestjs/swagger` + generación del documento en memoria — prerrequisito mecánico para poder derivar tools automáticamente desde los DTOs y decorators existentes, sin anotar cada endpoint a mano.

Existe un prototipo no mergeado (`feature/chat-ia-agente-admin`) con una idea equivalente para un chat widget interno del admin: deriva tools desde Swagger + un allowlist, y las ejecuta por HTTP firmando un JWT propio de corta vida. Ese patrón se porta a mcp-saas (no el código, que está mezclado con UI de chat y cuotas de uso ajenas a este feature).

## Alcance del MVP

**Incluye:**
- Servidor MCP en `services/mcp-saas/`, corriendo en **Cloudflare Workers** vía `McpAgent` (paquete `agents`, sobre Durable Objects) — patrón oficial de Cloudflare para servidores MCP, con aislamiento por tenant vía una instancia de Durable Object por negocio.
- Transporte Streamable HTTP (el vigente; SSE queda deprecado en el propio SDK).
- **Solo lectura (GET)**: allowlist inicial de 6 operaciones — `ProductsController_list`, `ReportsController_getSales`, `ReportsController_getTopProducts`, `ReportsController_getDaily`, `ReportsController_getCashiers`, `ReportsController_getOrders`.
- Un único tenant configurado (Pippo) — sin persistencia multi-tenant en base de datos todavía.
- Provisioning de acceso **híbrido**: el superadmin habilita el módulo por negocio (`enabledModules.mcpSaas`, mismo patrón que `aiChat`/`telegram`/`mesero`), y el admin del propio negocio genera/regenera su API key self-serve desde Settings (mismo patrón que `Devices`).

**No incluye (futuro):**
- Tools de escritura (crear pedido, ajustar stock, etc.).
- Persistencia multi-tenant en base de datos para mcp-saas (hoy: un tenant, config por env/binding).
- OAuth completo (`@cloudflare/workers-oauth-provider`) — se evalúa si hace falta un flujo de login interactivo para terceros.
- Rate limiting y audit log de tool calls.
- Refresh proactivo de token (v1: retry-on-401).
- Rotación/expiración automática de la API key de negocio.

## Decisiones ya tomadas

- **Runtime**: Cloudflare Workers + `McpAgent`, no un proceso Node/Express — encaja con el modelo multi-tenant (1 Durable Object por negocio) y es el patrón que Cloudflare recomienda para MCP.
- **Auth de mcp-saas contra el backend de Pippo**: intercambio de API key por JWT de corta vida (5 min), vía un perfil sintético (`role: 'admin'`, `businessId`, `branchId: null`) creado la primera vez que se usa una key. Se descartó un guard paralelo (tipo `ApiKeyGuard`) porque hubiera obligado a re-declarar guards/roles en cada controller del allowlist — el intercambio deja `ReportsController`/`ProductsController`/`JwtAuthGuard` sin ningún cambio.
- **Exposición del spec OpenAPI**: `GET /mcp/openapi.json`, protegido por el mismo `JwtAuthGuard` de siempre (no un mecanismo nuevo) — funciona igual en dev y en producción, a diferencia de `/api-docs` (HTML), que sigue gateado a `NODE_ENV !== 'production'`.
- **Provisioning de la API key — modelo híbrido**: superadmin habilita el flag por negocio (control centralizado de quién tiene acceso externo habilitado), admin del negocio genera su propia key (la key nunca pasa por manos del superadmin). Se descartó que el superadmin genere y entregue la key manualmente (sin precedente en el código, flujo operativo extra) y que cualquier negocio la genere sin flag previo (pierde control centralizado sobre un canal de acceso externo).
- **Dos capas de credencial**: la API key (`pippo_mcp_...`) no expira sola, solo se revoca manualmente (`is_active: false`) — igual que `Devices`. El JWT derivado de ella sí expira a los 5 minutos y es lo único que viaja en cada llamada real a un endpoint de negocio.

```
mcp-saas (Worker)                    Backend Pippo
       │                                   │
       │  POST /mcp/token                  │
       │  { apiKey: "pippo_mcp_..." }      │
       ├──────────────────────────────────►│
       │                                   │  valida hash contra mcp_api_keys
       │                                   │  busca/crea el perfil sintético
       │                                   │  del negocio dueño de esa key
       │  { access_token: "<jwt, 5min>" }  │
       │◄──────────────────────────────────┤
       │                                   │
       │  GET /reports/sales               │
       │  Authorization: Bearer <jwt>      │
       ├──────────────────────────────────►│
       │                                   │  JwtAuthGuard normal, como
       │                                   │  cualquier otro request
       │  { datos reales }                 │
       │◄──────────────────────────────────┤
```

## Qué falta técnicamente (resumen)

- Modelo Prisma `McpApiKey` + migración `056_mcp_api_keys.sql` (tabla nueva, checklist de RLS/GRANT/policies).
- Migración `057_business_enabled_modules_mcp_saas.sql` (flag `mcpSaas` en `enabled_modules`, default `false`).
- `packages/shared/src/constants/business-modules.ts` — agregar `mcpSaas` a `BUSINESS_MODULE_KEYS`/`DEFAULT_ENABLED_MODULES` (única fuente de verdad, alimenta superadmin + `/auth/me` sin tocar `businesses.controller.ts`).
- `backend/src/mcp/` — módulo nuevo: `mcp-keys.controller/service.ts` (self-serve, `@Roles('admin')`, calco de `devices`), `mcp-auth.controller/service.ts` (`POST /mcp/token` sin guard + `GET /mcp/openapi.json` con `JwtAuthGuard`), `openapi-document.holder.ts`.
- `frontend/src/features/mcp/` — tab "MCP" en Settings, gateado por `enabledModules.mcpSaas`, calco de `Devices`/`DeviceApiKeyModal`.
- `services/mcp-saas/` — scaffold del Worker: `wrangler.jsonc`, `mcp-agent.ts` (extiende `McpAgent`), `tool-registry.ts`/`tool-executor.ts` (puerto del patrón de `feature/chat-ia-agente-admin`), `pippo-client.ts` (intercambio de token).
- Root `package.json` — agregar `"services/*"` a `workspaces`.

Ver el plan de implementación completo (con paths y detalle archivo por archivo) en el historial de la conversación de diseño — este doc es el resumen de referencia, no el plan de ejecución paso a paso.

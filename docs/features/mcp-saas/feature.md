# mcp-saas — servidor MCP genérico sobre el backend de Pippo

## Estado

**Implementado en `feature/mcp-server`, sin commitear/mergear todavía, sin probar contra un backend real.** Este documento es la referencia a leer antes de tocar cualquier módulo relacionado con `services/mcp-saas`, `backend/src/mcp/`, o el flag `enabledModules.mcpSaas`.

## Objetivo

Exponer datos reales del negocio (ventas, stock, pedidos, productos) a través del protocolo MCP (Model Context Protocol), para que Claude u otras apps externas puedan consultarlos sin pasar por el panel admin. No es una integración puntual para Pizzería Pippo: **mcp-saas es un servidor MCP genérico** — toma el spec OpenAPI + un allowlist de cualquier backend REST y lo convierte en tools MCP. Pippo es el primer tenant configurado, no un caso hardcodeado en el código.

## Contexto

El backend de Pippo (NestJS, ~22 controllers, JWT + roles, multi-tenant por `business_id`) no tenía documentación OpenAPI. Como paso previo (rama `feature/mcp-server`) se agregó `@nestjs/swagger` + generación del documento en memoria — prerrequisito mecánico para poder derivar tools automáticamente desde los DTOs y decorators existentes, sin anotar cada endpoint a mano.

Existe un prototipo no mergeado (`feature/chat-ia-agente-admin`) con una idea equivalente para un chat widget interno del admin: deriva tools desde Swagger + un allowlist, y las ejecuta por HTTP firmando un JWT propio de corta vida. Ese patrón se porta a mcp-saas (no el código, que está mezclado con UI de chat y cuotas de uso ajenas a este feature).

## Alcance del MVP

**Incluye:**
- Servidor MCP en `services/mcp-saas/`, corriendo como **proceso Node normal** (Hono + `@hono/node-server`), expuesto por ahora vía **túnel de Cloudflare** (`cloudflared`) en vez de desplegado a Cloudflare Workers — un deploy a Workers queda como posible paso futuro, no es el plan para esta iteración (ver "Decisiones ya tomadas").
- La lógica MCP en sí (`WebStandardStreamableHTTPServerTransport` del propio `@modelcontextprotocol/sdk`) es Web Standard puro — corre igual en Node 18+, Cloudflare Workers, Deno o Bun sin cambios. Todo `src/` excepto `index.ts` (tool-registry, tool-executor, pippo-client, allowed-operations) es TypeScript sin ninguna dependencia de Cloudflare — el único archivo acoplado al runtime es el entry point (`index.ts`, hoy con `@hono/node-server`), así que migrar a Workers más adelante es acotado si hace falta.
- Transporte Streamable HTTP en modo *stateless* (sin `sessionIdGenerator`) — cada request arma su propio `Server`/transport, respaldado por una caché en memoria del proceso (keyed por hash de la API key) para no re-intercambiar el token ni re-pedir el spec de OpenAPI en cada tool call.
- **Solo lectura (GET)**: allowlist inicial de 6 operaciones — `ProductsController_list`, `ReportsController_getSales`, `ReportsController_getTopProducts`, `ReportsController_getDaily`, `ReportsController_getCashiers`, `ReportsController_getOrders`.
- Un único tenant configurado (Pippo) — sin persistencia multi-tenant en base de datos todavía.
- Provisioning de acceso **híbrido**: el superadmin habilita el módulo por negocio (`enabledModules.mcpSaas`, mismo patrón que `aiChat`/`telegram`/`mesero`), y el admin del propio negocio genera/regenera su API key self-serve desde Settings (mismo patrón que `Devices`).

**No incluye (futuro):**
- Deploy a Cloudflare Workers (hoy: proceso Node + túnel de Cloudflare).
- Tools de escritura (crear pedido, ajustar stock, etc.).
- Persistencia multi-tenant en base de datos para mcp-saas (hoy: un tenant, config por env).
- OAuth completo (`@cloudflare/workers-oauth-provider`) — relevante solo si en el futuro se migra a `McpAgent`/Durable Objects.
- Rate limiting y audit log de tool calls.
- Refresh proactivo de token (v1: retry-on-401).
- Rotación/expiración automática de la API key de negocio.

## Decisiones ya tomadas

- **Runtime**: proceso Node normal (Hono + `@hono/node-server`), expuesto por túnel de Cloudflare por ahora — no un deploy a Cloudflare Workers. Antes de esto se evaluaron dos alternativas de Cloudflare y se descartaron:
  - `McpAgent` (paquete `agents`, sobre Durable Objects) — el patrón que Cloudflare promociona para MCP, con la idea de 1 Durable Object por negocio. Se descartó al implementar: `McpAgent.serve()` enruta por *sesión* (arma un ID nuevo por conexión y hace un upgrade a WebSocket interno) y **no reenvía el `Authorization` header original** al Durable Object; la única vía soportada para inyectar identidad custom es `ctx.props`, que es de solo lectura y solo lo puebla `@cloudflare/workers-oauth-provider` (OAuth completo). Bypassear esto a mano hubiera dependido de un método interno (`_init`) no pensado para uso externo.
  - Worker plano en Cloudflare (sin Durable Objects) — técnicamente funcionaba (`tsc` pasaba limpio), pero el deploy a Workers en sí no era lo que se había pedido para esta iteración — Cloudflare queda para una fase futura, ahora se usa un túnel simplemente para exponer el proceso Node local sin deployar nada.
  - En cualquiera de las tres opciones la lógica MCP (`WebStandardStreamableHTTPServerTransport`) es la misma — el único archivo que cambia entre Node y Workers es el entry point (`index.ts`), así que la decisión no compromete portabilidad futura.
- **Auth de mcp-saas contra el backend de Pippo**: intercambio de API key por JWT de corta vida (5 min), vía un perfil sintético (`role: 'admin'`, `businessId`, `branchId: null`) creado la primera vez que se usa una key. Se descartó un guard paralelo (tipo `ApiKeyGuard`) porque hubiera obligado a re-declarar guards/roles en cada controller del allowlist — el intercambio deja `ReportsController`/`ProductsController`/`JwtAuthGuard` sin ningún cambio.
- **Exposición del spec OpenAPI**: `GET /mcp/openapi.json`, protegido por el mismo `JwtAuthGuard` de siempre (no un mecanismo nuevo) — funciona igual en dev y en producción, a diferencia de `/api-docs` (HTML), que sigue gateado a `NODE_ENV !== 'production'`.
- **Provisioning de la API key — modelo híbrido**: superadmin habilita el flag por negocio (control centralizado de quién tiene acceso externo habilitado), admin del negocio genera su propia key (la key nunca pasa por manos del superadmin). Se descartó que el superadmin genere y entregue la key manualmente (sin precedente en el código, flujo operativo extra) y que cualquier negocio la genere sin flag previo (pierde control centralizado sobre un canal de acceso externo).
- **Dos capas de credencial**: la API key (`pippo_mcp_...`) no expira sola, solo se revoca manualmente (`is_active: false`) — igual que `Devices`. El JWT derivado de ella sí expira a los 5 minutos y es lo único que viaja en cada llamada real a un endpoint de negocio.

```
mcp-saas (proceso Node)              Backend Pippo
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

## Qué se hizo (resumen de implementación)

- Modelo Prisma `McpApiKey` + migración `056_mcp_api_keys.sql` (tabla nueva, checklist de RLS/GRANT/policies) — **migración pendiente de aplicar manualmente en Supabase**, ver `docs/database/migrations/PENDING.md`.
- Migración `057_business_enabled_modules_mcp_saas.sql` (flag `mcpSaas` en `enabled_modules`, default `false`) — también pendiente de aplicar.
- `packages/shared/src/constants/business-modules.ts` — `mcpSaas` agregado a `BUSINESS_MODULE_KEYS`/`DEFAULT_ENABLED_MODULES`.
- `backend/src/mcp/` — `mcp-keys.controller/service.ts` (self-serve, `@Roles('admin')`), `mcp-auth.controller/service.ts` (`POST /mcp/token` sin guard + `GET /mcp/openapi.json` con `JwtAuthGuard`), `openapi-document.holder.ts`. `AuthModule` ahora re-exporta `JwtModule` para que `McpAuthService` pueda firmar sus propios tokens.
- `frontend/src/features/mcp/` — tab "MCP" en Settings, gateado por `enabledModules.mcpSaas`.
- `services/mcp-saas/` — proceso Node (Hono + `@hono/node-server`): `index.ts` (rutas `/health` y `/mcp`, caché en memoria por API key), `tool-registry.ts`/`tool-executor.ts` (puerto del patrón de `feature/chat-ia-agente-admin`), `pippo-client.ts` (intercambio de token, retry-on-401).
- Root `package.json` — `"services/*"` agregado a `workspaces`, script `mcp-saas:dev`.

## Qué falta para probarlo end-to-end

- Aplicar las migraciones `056`/`057` en Supabase (local o real).
- Levantar el backend (`npm run backend:dev`), habilitar `mcpSaas` para un negocio desde el panel de superadmin, generar una API key desde Settings → MCP.
- Copiar `services/mcp-saas/.env.example` a `.env`, ajustar `PIPPO_BACKEND_URL`/`PORT` si hace falta, `npm run mcp-saas:dev` desde la raíz (o `npm run dev` dentro de `services/mcp-saas/`).
- Para exponerlo hacia afuera: `cloudflared tunnel --url http://localhost:8787` (o el túnel nombrado que se configure) — separado de este código, es infraestructura, no queda documentado acá todavía.
- Conectar un cliente MCP (`npx @modelcontextprotocol/inspector`, o config remota en Claude) contra `http://localhost:8787/mcp` (o la URL del túnel) + `/mcp`, con la API key generada en el header `Authorization: Bearer <key>`.
- Nunca se corrió el proceso real contra esto — el código pasa `tsc --noEmit` pero no fue probado en runtime.

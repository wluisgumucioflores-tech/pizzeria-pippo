# Chat de IA agéntico en el panel admin, con tools basadas en Swagger

## Contexto

El admin quiere un chat de IA accesible desde cualquier página del panel (ícono flotante abajo a la derecha), configurable en cuanto a proveedor/modelo de IA, que funcione como un **agente con tool-calling real** (no solo un chat con contexto inyectado): el modelo debe poder consultar datos reales del negocio (ventas, stock, productos, promos) invocando herramientas concretas, y esas herramientas tienen que salir de la documentación **Swagger/OpenAPI** del backend — que hoy no existe y hay que construir primero — con una capa de seguridad explícita que limite qué puede invocar el agente.

Decisiones ya validadas con el usuario:
1. Config de IA independiente de la del bot de Telegram (`ai_chat_*`, propio tab en Settings, vía la tabla genérica `AppSetting` que ya existe — sin migraciones).
2. Documentar **todo el backend** con Swagger (los 23 módulos), no solo un subset.
3. v1 del agente: **solo tools de lectura (GET)** — nada que modifique datos todavía.
4. Las tools se ejecutan por **HTTP real contra los propios endpoints** (no llamadas directas a los services) — así el agente pasa por los mismos guards (`JwtAuthGuard`, `RolesGuard`, `@Roles()`) que cualquier otro cliente, sin duplicar lógica de autorización ni acoplar el módulo de IA a los services internos de cada feature.
5. El agente tiene **su propia identidad de auth**, no la del usuario que abrió el chat: una API key propia del negocio, generable/regenerable/revocable desde Settings (mismo patrón visual que ya existe en "Devices" — `DeviceApiKeyModal`), con permisos fijos y acotados al allowlist de solo-lectura. Esto evita que el alcance del agente dependa de qué tan amplio sea el rol del admin que abrió el chat, y evita que un bug en el tool-executor pueda escalar más allá de lo que esa key permite.

Este plan tiene dos fases secuenciales — la primera (Swagger) es un prerrequisito mecánico e independiente; la segunda (el agente) recién se construye sobre eso. Se valida cada fase por separado antes de seguir a la siguiente.

---

## Fase 1 — Documentar el backend con Swagger/OpenAPI

Hoy no hay nada de esto: `backend/src/main.ts` no llama a `SwaggerModule`, y `@nestjs/swagger` no está en `backend/package.json`.

1. `npm install @nestjs/swagger --workspace=backend`.
2. Activar el plugin de compilación de Nest en `backend/nest-cli.json` (`compilerOptions.plugins: ["@nestjs/swagger"]`) — infiere `@ApiProperty` de los tipos TypeScript existentes en los DTOs automáticamente, sin tener que anotar a mano cada uno de los ~23 módulos.
3. En `backend/src/main.ts`, agregar `SwaggerModule.createDocument(app, config)` + `SwaggerModule.setup('api-docs', app, document)`, con `DocumentBuilder().addBearerAuth()` (para que quede reflejado que los endpoints requieren JWT). El doc HTML (`/api-docs`) se expone solo si `NODE_ENV !== 'production'` — no queremos el mapa completo de la API público en producción.
4. Agregar `@ApiTags('<módulo>')` a cada controller (23 archivos, cambio de una línea cada uno) para que el spec quede organizado por dominio — mismo criterio que ya usan los módulos existentes (`products`, `stock`, `promotions`, etc.).
5. Nada de esto cambia comportamiento de runtime de los endpoints existentes — es aditivo.

**Verificación Fase 1:** `npx tsc --noEmit` en `backend/`, y (usuario) levantar el backend con `npm run backend:dev` y confirmar en el navegador que `/api-docs` muestra los 23 módulos con sus operaciones.

---

## Fase 2 — Agente de chat con tools

### Estructura de módulos (pensada para escalar a multi-agente sin reescribir)

```
backend/src/
├── ai/                          ← "llm": compartido con el bot de Telegram
│   └── providers/                 (Anthropic, OpenAI-compatible/Qwen/Ollama, factory)
└── ai-chat/
    ├── ai-chat.module.ts
    ├── ai-chat.controller.ts       POST /ai-chat/message, POST /ai-chat/internal-key/generate
    ├── orchestrator/
    │   └── orchestrator.service.ts   hoy: recibe el mensaje y llama al único agente.
    │                                  Mañana: acá vive el ruteo si se suman más agentes.
    ├── agents/
    │   └── query-agent.service.ts    el único agente de v1 — arma el system prompt,
    │                                  corre el loop complete()↔tools, solo lectura.
    ├── tool-registry/
    │   ├── tool-registry.service.ts  deriva tools desde el spec de OpenAPI + allowlist
    │   └── allowed-operations.ts     allowlist explícito de operationIds
    ├── api-client/
    │   └── tool-executor.service.ts  firma el JWT propio del agente + hace el fetch real
    └── internal-key/
        └── internal-key.service.ts   generar/revocar la API key interna (Settings)
```

No se construye el router multi-agente todavía (con ~6-8 tools de solo lectura, un agente con un tool registry bien curado ya resuelve la selección sin necesitar una clasificación de intención previa) — pero la carpeta `agents/` ya deja el lugar para sumar `sales-agent.service.ts`/`action-agent.service.ts` el día que el número de tools o los conflictos de contexto lo justifiquen, y `orchestrator.service.ts` es donde empezaría a haber lógica de ruteo real en vez de un passthrough.

### 2.1 Extraer y extender los clientes de IA (soporte de tool-calling)

Mover `backend/src/telegram/ai-providers/*` → `backend/src/ai/providers/*` (interfaz, factory, cliente Anthropic, cliente OpenAI-compatible + specs), en un `AiModule` compartido que `TelegramModule` también pasa a importar (sin cambiar su comportamiento actual, sigue siendo de un solo turno).

**Modelo configurable, incluido local vía Ollama:** no hace falta código especial — `OpenAiCompatibleProviderClient` ya acepta `baseURL` configurable (hoy se usa para Qwen vía DashScope). Ollama expone una API compatible con OpenAI (`http://localhost:11434/v1` por defecto), así que correr Qwen3 4B local es simplemente: proveedor `openai_compatible`, `baseURL` apuntando al servidor Ollama, modelo = el tag que tengas pulleado (ej. `qwen3:4b`), API key con un valor cualquiera (Ollama no la valida). **A probar antes de confiar en producción:** el soporte de tool-calling de Ollama depende de la versión y de si la plantilla del modelo lo soporta — con un modelo de 4B parámetros es esperable más selección de tool equivocada o JSON de argumentos mal formado que con Anthropic/GPT — conviene validarlo con preguntas reales del negocio antes de asumirlo confiable.

Extender `AiProviderClient` para soportar tools y multi-turno (los SDKs de Anthropic y OpenAI ya soportan esto nativamente — hoy el código solo usa la vía de texto plano):

```ts
export interface AiTool { name: string; description: string; inputSchema: object }
export interface AiChatMessage { role: 'user' | 'assistant' | 'tool'; content: string; toolCallId?: string; toolName?: string }
export interface AiToolCall { id: string; name: string; arguments: Record<string, unknown> }
export type AiCompletionResult = { type: 'text'; content: string } | { type: 'tool_calls'; calls: AiToolCall[] };

export interface AiProviderClient {
  complete(config: AiCompletionConfig, system: string, messages: AiChatMessage[], tools?: AiTool[]): Promise<AiCompletionResult>;
}
```

- `anthropic-provider.client.ts`: mapea `tools` al formato `tool_use` de Anthropic; si `response.stop_reason === 'tool_use'`, devuelve `{ type: 'tool_calls', calls }`.
- `openai-compatible-provider.client.ts`: mapea `tools` al formato `functions`/`tool_calls` de OpenAI; equivalente.
- `telegram-ai.service.ts`: sigue llamando `complete()` sin `tools` — recibe siempre `{ type: 'text' }`, cero cambio funcional.

### 2.2 Registro de tools desde el spec de OpenAPI + allowlist de seguridad

`ai-chat/tool-registry/tool-registry.service.ts`:
- En el boot de Nest, obtiene el documento OpenAPI ya generado en Fase 1 (`SwaggerModule.createDocument`, se guarda una referencia en memoria — no hace un fetch HTTP, es el mismo proceso).
- Filtra **solo operaciones GET**.
- Cruza contra `ai-chat/tool-registry/allowed-operations.ts` — un array de `operationId`s (ej. `StockController_getAlerts`, `ReportsController_getSales`, `ReportsController_getTopProducts`, `PromotionsController_findAll`, `ProductsController_findAll`) que el equipo revisa y aprueba a mano. Esta es la capa de seguridad explícita que pediste: aunque el rol del usuario técnicamente pueda pegarle a un endpoint, si no está en este allowlist el agente ni se entera de que existe.
- Convierte cada operación permitida en un `AiTool` (nombre = operationId, descripción = `summary`/`description` del spec, `inputSchema` = los `parameters` de esa operación en JSON Schema).

### 2.2b API key interna del agente + identidad propia (no la del usuario)

En vez de reenviar el JWT del admin que abrió el chat, el agente firma su **propio** JWT de corta duración por cada tool-call, usando el mismo `JwtService`/secret que ya usa `AuthModule` (`AuthModule` debe exportar `JwtService` si todavía no lo hace) — así no hace falta tocar ningún guard ni controller existente en el resto del backend, todos siguen esperando exactamente lo mismo que hoy (`Authorization: Bearer <jwt>`).

- **Generar la key** (Settings → tab "Chat IA", botón "Generar API key interna", modal calco de `DeviceApiKeyModal`): `ai-chat/internal-key/internal-key.service.ts`, endpoint `POST /ai-chat/internal-key/generate` (`@Roles('admin')`). Genera `pippo_aichat_${randomBytes(24).toString('base64url')}` (mismo esquema que `DevicesService.create()`), lo guarda en texto plano vía `settingsService.saveRawSettings(user, [{ key: 'ai_chat_internal_api_key', value: rawKey }])` — mismo criterio que las api keys de proveedores de IA, que hoy tampoco se cifran en este proyecto — y lo devuelve una única vez para mostrarlo en el modal. **Revocar** = guardar ese mismo key con valor vacío (reusa `PUT /settings/raw`, no hace falta otro endpoint).
- Esta key **nunca viaja por HTTP** en ningún tool-call — es el "interruptor + credencial visible" que prueba que un admin habilitó explícitamente el acceso a tools para ese negocio, y le da control real (generarla/revocarla) sin depender del rol de quien esté chateando en ese momento.
- `api-client/tool-executor.service.ts`, en cada tool-call:
  1. Verifica que `ai_chat_internal_api_key` esté configurada y no vacía para el negocio del admin que abrió el chat (`business_id` que ya viene de su JWT normal en `POST /ai-chat/message`) — si no está configurada, no ejecuta tools (el agente responde en texto, sin datos, y avisa que falta configurar la key).
  2. Firma un JWT propio de vida corta (ej. 2 minutos) con claims `{ business_id, role: 'admin', sub: 'ai-chat-agent' }` — el `business_id` es siempre el del negocio dueño de la key, nunca el del usuario logueado directamente.
  3. Resuelve `path` + `method` de la operación desde el spec de OpenAPI (Fase 1), arma la URL (`http://localhost:${PORT}` + path, sustituyendo path/query params con los argumentos que mandó el modelo).
  4. `fetch(url, { headers: { Authorization: \`Bearer ${jwtRecienFirmado}\` } })` — pasa por el `JwtAuthGuard`/`RolesGuard` real del endpoint, igual que cualquier otro cliente.
  5. Devuelve el body de la respuesta como resultado de la tool.

### 2.3 Orchestrator → Agent → loop de tools

- `orchestrator/orchestrator.service.ts` — `handleMessage(user, messages)`: hoy es un passthrough directo a `QueryAgentService` (no hay clasificación de intención todavía, un solo agente atiende todo). Es el único lugar que tocaría el día que se agregue un segundo agente.
- `agents/query-agent.service.ts` — `run(user, messages)`:
  1. Resuelve config del proveedor (`ai_chat_provider`, `ai_chat_*_api_key`, `ai_chat_model` — vía `SettingsService.getRawSettings`, mismo patrón/keys ya definido antes, sin fallback a env, `BadRequestException` si no está configurado).
  2. Arma system prompt simple ("sos el asistente del panel de Pizzería Pippo, tenés acceso a herramientas de consulta, usalas para responder con datos reales, no inventes números").
  3. Pide las tools permitidas a `ToolRegistryService` y llama `client.complete(config, system, messages, tools)`.
  4. Si `type === 'tool_calls'`: por cada call, `toolExecutor.execute(call, user.business_id)` (el executor firma su propio JWT de agente, ver 2.2b), agrega el resultado como mensaje de rol `tool` al historial, vuelve a llamar a `complete()` (loop acotado a máx. 4 iteraciones para evitar loops infinitos).
  5. Cuando `type === 'text'`, devuelve `{ content }`.
- `ai-chat.controller.ts`: `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('admin')`, `POST /ai-chat/message` (delega a `orchestrator.service.ts`) y `POST /ai-chat/internal-key/generate` (delega a `internal-key.service.ts`) — solo necesita `@CurrentUser()`, ya no hace falta leer el Bearer token crudo del request.
- `ai-chat.module.ts`: importa `AuthModule` (para `JwtService`), `SettingsModule`, `AiModule` — **no** importa `StockModule`/`ReportsModule`/etc., esa es justamente la desacoplada que buscás: el único vínculo con el resto del backend es HTTP + el spec de OpenAPI.

### 2.4 Frontend

Sin cambios respecto al diseño anterior — el contrato `POST /ai-chat/message` sigue siendo `{ messages } → { content }` desde el punto de vista del cliente, toda la complejidad del agente es interna al backend:

- `frontend/src/features/ai-chat/` — settings tab (`AiChatSettingsForm.tsx` + `useAiChatSettingsForm.ts`, mismo patrón que `telegram-bot`; más `AiChatApiKeyModal.tsx`, calco de `DeviceApiKeyModal`, con el botón "Generar API key interna" y el aviso de "se muestra una sola vez") y widget flotante (`AiChatWidget.tsx` con `FloatButton` de antd + `useAiChat.ts` con historial en memoria).
- Nuevo tab "Chat IA" en `frontend/src/app/(admin)/settings/page.tsx`.
- Widget montado una vez en `frontend/src/app/(admin)/layout.tsx`.

### Portabilidad futura (no se construye ahora, solo queda documentado)

`ai-chat` no importa ningún service de otro módulo (Stock, Reports, etc.) — todo pasa por HTTP, así que en principio se puede mover a otro proceso/servicio sin tocar imports de TypeScript. Quedan dos puntos atados al mismo proceso hoy, a resolver el día que se separe (no ahora):
1. **Spec de OpenAPI**: `tool-registry.service.ts` lo lee en memoria (`SwaggerModule.createDocument()`, mismo proceso). Separado, pasaría a `fetch` contra `GET /api-docs-json` del backend — cambio contenido a esa función.
2. **Firma del JWT del agente**: hoy reusa el `JwtService`/secret del backend por estar en el mismo proceso. Separado, hay que elegir entre compartir `JWT_SECRET` entre servicios o que el backend exponga un endpoint que emita el token con scopes acotados — decisión pendiente para ese momento, no se resuelve en este plan.

No hay Gateway hoy en el proyecto (el frontend pega directo al backend); con un solo servicio nuevo no haría falta uno — se evalúa si en el futuro se suman más servicios.

## Fuera de alcance para v1 (explícito)

- Tools que escriben/modifican datos (crear promo, ajustar stock) — la arquitectura de allowlist ya queda lista para sumarlas después, revisando cada una a mano antes de habilitarla.
- Streaming token a token.
- Persistencia del chat entre sesiones.
- Documentar manualmente cada DTO con `@ApiProperty` — se usa el plugin del compilador en su lugar.

## Verificación

- Fase 1: `npx tsc --noEmit` en `backend/`; usuario levanta `npm run backend:dev` y revisa `/api-docs`.
- Fase 2: `npx tsc --noEmit` + `npm run test --workspace=backend` (specs de `ai-providers` actualizados a la nueva firma con tools). Probar el flujo real: usuario corre `npm run dev`, configura el proveedor en Settings → "Chat IA", abre el ícono flotante, pregunta algo que requiera datos reales (ej. "¿hay stock bajo en alguna sucursal?") y confirma que el agente invoca la tool correcta y responde con datos reales — y que si loguea con un rol sin permiso a un endpoint, la tool falla igual que fallaría un fetch manual a ese endpoint.

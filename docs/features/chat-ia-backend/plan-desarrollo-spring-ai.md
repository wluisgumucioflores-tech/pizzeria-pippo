# Plan de desarrollo — Servicio Spring AI (chat-ia orquestador)

## Contexto

Construir el chat-ia como un **servicio Spring AI (Java) separado** para escalar la IA aparte del backend. NestJS queda como backend de negocio/datos; Ollama+Qwen (local) y proveedores cloud para inferencia. La evaluación de reuso está en `docs/features/chat-ia-backend/evaluacion-reuso-rama-y-poc.md` — este plan la ejecuta **paso a paso, validando cada fase antes de seguir** (regla del proyecto: una cosa a la vez).

### Decisiones fijadas
- **Stack**: Java 21 (LTS, provisto por Gradle toolchain — no requiere instalarlo a mano) + Spring Boot 3.4.x + Spring AI 1.0.x + **Gradle (Kotlin DSL)**, wrapper fijado a Gradle 8.10.x.
- **Ubicación**: `services/ai-orchestrator/` — se excluye del glob `services/*` en el `package.json` raíz para que npm no lo trate como workspace Node.
- **Tools: directo a NestJS (decisión final, revierte el pivote MCP intermedio)**: se evaluó conectar el orquestador como **MCP client** de `services/mcp-saas` (reusar su allowlist/ejecución/auth), pero se descartó — `mcp-saas` es una **feature de producto aparte** (expone datos a clientes MCP *externos* como Claude), no una dependencia del chat-ia interno. El orquestador Spring le pega **directo** a NestJS con **su propia identidad de agente**, independiente de `backend/src/mcp`.
- **Identidad del agente (propia, en `backend/src/ai-chat`)**: `AgentIdentityService` + endpoint `POST /ai-chat/agent-token` (protegido con `InternalTokenGuard`) — crea/reusa un `Profile` "agente" por negocio y firma un JWT corto (120s) con el `JWT_SECRET` del backend. Spring nunca conoce `JWT_SECRET`; solo el token interno de plataforma (`PIPPO_INTERNAL_TOKEN`) para pedir su JWT de agente.
- **Prerequisitos NestJS**: Swagger/OpenAPI **ya está en main** (vía el módulo MCP, reusable como referencia si más adelante se arma un tool-registry propio). El allowlist/tool-registry/tool-executor del `ai-chat` se construyen **propios, en Java**, sin depender de `services/mcp-saas`. Falta **cherry-pick** de planes/cuotas + frontend widget + flag de módulo desde `feature/chat-ia-agente-admin`.
- **Config de modelos**: gateada **por plan** (`limits` JSON) + **keys cloud centralizadas** de plataforma (§6 de la evaluación).
- **Seams v1 (simplificados)**: memoria = **in-memory** primero; keys cloud = **env/secret del servicio Spring**; tools = una por una en Java (empezando por ventas), sin derivación automática de OpenAPI todavía (eso queda para cuando haya más de 3-4 tools y valga la pena automatizarlo).

### Orden revisado
Se construye primero el **core del orquestador** (más novedoso/riesgoso), testeable con Ollama local + backend NestJS, y después la productización:
**2 (scaffold) → 3 (Ollama) → 4 (tool real directo a NestJS) → 6 (orquestación) → 7 (memoria)**, luego **0.3/0.4 (cherry-picks) → 0.5+9 (widget + proxy + cuota, fusionadas) → 1 (modelos por plan) → 8 (cloud+gating)**. Las fases 0.5 y 9 se hicieron juntas: no tenía sentido dejar el widget montado como "stub" sin backend real detrás cuando ya estaban construidas todas las piezas (`AiChatQuotaService`, el propio `/chat/tools` de Spring) para que funcione de punta a punta de una.

---

## Fase 0 — Prerequisitos NestJS (cherry-pick, sin Java todavía)

**Objetivo:** dejar el backend/front listos para que el servicio Spring se enganche. Todo testeable en la app actual.

- **0.1 Swagger/OpenAPI** — ✅ **YA HECHO en main** (módulo MCP): `@nestjs/swagger` + plugin + `OpenApiDocumentHolder`, expuesto en `/api-docs`/`/api-docs-json`. No se usa por ahora (Fase 4 llama a un endpoint fijo, sin derivar tools del spec) — queda disponible para cuando se automatice el tool-registry propio.
- **Identidad del agente** — ✅ **HECHO, propia** (Fase 4): `backend/src/ai-chat/agent-identity.service.ts` + `POST /ai-chat/agent-token`, independiente de `backend/src/mcp`.
- **0.3 Planes/cuotas/uso** — ✅ **HECHO**: cherry-pick `backend/src/ai-chat-plans/`, `backend/src/ai-chat-usage/`, migraciones `060`/`061` (renumeradas — `056`/`057` de la rama vieja ya estaban ocupadas en main por la feature MCP; se agregó RLS/GRANT/policies que la rama vieja no tenía), cambios de `schema.prisma` (`AiChatPlan`, `AiChatUsage`, FK `Business.aiChatPlanId`). Superadmin `/ai-chat-plans` (CRUD) + `AiChatQuotaService`. Frontend: feature `ai-chat-plans/` completa (tabla+modal+page+nav) y columna read-only "Plan Chat IA" en `BusinessesTable`. Validado por el usuario (backend vía curl, frontend vía `tsc --noEmit` limpio en los 3 paquetes).
- **0.4 Flag de módulo** `aiChat` — ✅ **HECHO**: agregado a `BUSINESS_MODULE_KEYS`/`DEFAULT_ENABLED_MODULES` (`packages/shared`, default `false`, coincide con el default ya seteado en migración `060`) y su label en `modules.constants.ts` del frontend. El `Checkbox.Group` de `BusinessEditModal` es genérico (driven by `BUSINESS_MODULE_KEYS`), no requirió tocarlo. Validado por el usuario en el modal de edición de negocio.
- **0.5 Frontend** — ✅ **HECHO** (fusionada con Fase 9, ver abajo): cherry-pick **recortado** de `frontend/src/features/ai-chat/` — solo `AiChatWidget`, `useAiChat`, `ChatMarkdown` y `sendChatMessage`/`ChatMessage`. **No** se trajo `AiChatSettingsForm`/`AiChatApiKeyModal`/`AiChatUsageToday` ni el tab de Settings con selección de proveedor/API key — es justo lo que la Fase 1 va a eliminar (keys centralizadas, no BYO key), no tenía sentido cherry-pickearlo para tirarlo después. Widget montado en `(admin)/layout.tsx`, gateado por `enabledModules.aiChat` (mismo patrón que la rama vieja).

**✅ Prueba:** `/api-docs-json` devuelve el spec (hecho, ya en main); superadmin crea/edita planes (hecho); el flag `aiChat` prende/apaga el módulo (hecho); el widget renderiza y funciona end-to-end (hecho, ver Fase 9).

---

## Fase 1 — Modelos por plan + keys centralizadas ✅ (completada)

**Objetivo:** el superadmin controla qué modelo usa cada negocio, vía su plan; las keys las pone la plataforma.

**Decisión de producto (ajustada durante la implementación):** el negocio **no elige modelo** — no hay selector en su panel (se deja para una fase futura, si se necesita). Cada plan define **un único modelo** (`limits.model_id`), no una lista de "modelos permitidos": una lista solo tendría sentido si existiera un selector para elegir dentro de ella, y hoy no lo hay. Menos superficie, nada especulativo.

- **1.1 Catálogo de modelos, ahora con CRUD real**: antes `ai_models` solo existía sembrado a mano en la BD, sin ningún endpoint. Nuevo `AiModelsController` (`backend/src/ai-chat/ai-models.controller.ts`, `@Roles('superadmin')`): `GET/POST/PATCH /ai-models`. `AiModelsService` extendido con `list/create/update`, maneja en transacción el único `is_default` (índice único parcial de la migración 058). Nueva feature frontend `ai-models/` (tabla + modal) y página superadmin `/ai-models`.
- **1.2** `ai_chat_plans.limits.model_id` (referencia a `ai_models.id`) — `AiChatPlanModal` suma un `Select` de modelo (poblado del catálogo). Sin cambio de esquema (jsonb ya flexible); migración `062` solo documenta la clave nueva y backfillea los 3 planes seedeados con el modelo `is_default` actual, para no cambiar el comportamiento de ningún negocio existente. No se tocó el Settings del admin porque nunca se había cherry-pickeado esa parte (ver nota en Fase 0.5) — no hay campos de key que remover.
- **1.3** `GET /ai-chat/runtime-config?businessId=...` — `AiModelsService.getRuntimeConfigForBusiness(businessId)`: resuelve el negocio → su plan → `limits.model_id`; si el plan no tiene modelo asignado o el modelo quedó inactivo, cae al `is_default` global (mismo fallback de siempre, nunca deja a un negocio sin servicio). Sin `businessId` (el endpoint `/chat` de puro smoke-test de la Fase 3), mantiene el comportamiento global de antes. Spring (`RuntimeConfigClient.fetch(businessId)`, `AgentController`) ahora manda el `businessId` que ya tenía disponible en cada request de `/chat/tools`.

**✅ Prueba:** compila limpio (`tsc --noEmit` en `backend`/`frontend`, `./gradlew compileJava` en el orquestador). Pendiente de que el usuario pruebe en el navegador: crear/editar un modelo en `/ai-models`, asignarlo a un plan en `/ai-chat-plans`, y confirmar que un negocio de ese plan efectivamente usa ese modelo al chatear (columna `model`/`baseUrl` en la respuesta del widget, o el log del servicio Spring).

---

## Fase 2 — Scaffold del servicio Spring AI (Java, hello world)

**Objetivo:** proyecto Java corriendo, aislado.

- **2.1** `services/ai-orchestrator/` con Gradle (Kotlin DSL), Java 21, Spring Boot 3.4.x, BOM de Spring AI 1.0.x. Endpoint `/actuator/health`.
- **2.2** Ajustar `package.json` raíz: `services/*` → explícito `services/mcp-saas` (excluir el dir Java del workspace npm).
- **2.3** `Dockerfile` del servicio (patrón `backend/Dockerfile`); opcionalmente sumarlo a `docker/docker-compose.yml`.

**✅ Prueba:** `./gradlew bootRun` levanta; `GET /actuator/health` → `UP`.

---

## Fase 3 — Primera inferencia local (Ollama, sin tools)

**Objetivo:** validar temprano y barato el mayor riesgo (modelo local), sin keys.

- **3.1** Ollama en `docker-compose` (o local); `ollama pull` del modelo (ej. `qwen2.5:3b-instruct`). Starter Ollama de Spring AI.
- **3.2** `POST /chat` con prompt plano → texto (Spring AI `ChatClient`).

**✅ Prueba:** "hola" → responde el Qwen local.

---

## Fase 4 — Una tool real, directo a NestJS (identidad propia del agente)

**Objetivo:** el agente Spring ejecuta una tool real contra el negocio, pegándole directo al backend NestJS, sin pasar por `services/mcp-saas` (esa es una feature aparte, para clientes MCP externos).

- **4.1 NestJS** — `backend/src/ai-chat/agent-identity.service.ts` (`AgentIdentityService`): crea/reusa un `Profile` "agente" por negocio (`ai-chat-agent+<businessId>@internal...`, rol `admin`) y firma un JWT corto (120s) con `JWT_SECRET`. Endpoint `POST /ai-chat/agent-token` (`{ businessId }`), protegido con `InternalTokenGuard` (mismo guard de `runtime-config`, Fase 3).
- **4.2 Spring** — `PippoAgentClient` (`backend/PippoAgentClient.java`): pide el JWT del agente (`POST /ai-chat/agent-token`) y con ese Bearer ejecuta `GET` contra el endpoint real. Sin caché de token (dura 120s, se pide uno nuevo por tool-call).
- **4.3 Spring** — `SalesTools` (tool `@Tool`/`@ToolParam` sobre `GET /reports/sales`, con `from`/`to` opcionales): **no es un `@Component`** — se construye por-request en `AgentController`, atada al `businessId` de esa llamada. El modelo nunca elige el negocio (no es un parámetro de la tool).
- Endpoint expuesto: `POST /chat/tools` con body `{ message, businessId }`.

**✅ Prueba:** con backend + Ollama levantados, `POST /chat/tools {"message":"¿cuánto se vendió hoy?","businessId":"<uuid>"}` → Spring pide su JWT de agente → llama `/reports/sales` → responde con dato real del negocio.

---

## Fase 6 — System prompt en BD + AgentRegistry extensible ✅ (completada)

**Objetivo:** el flujo del POC, adaptado a Spring AI — sin duplicar con llamadas extra al modelo lo que el `ChatClient` ya resuelve nativo.

- **6.1 System prompt data-driven**: tabla `ai_prompts` (migración `059`, seed es/en portado de `build-system-prompt.ts` de la rama vieja) + `GET /ai-chat/system-prompt?locale=` (NestJS, `AiPromptsService`) + `SystemPromptClient` (Spring, sin caché — se pide fresco en cada turno). Editar la fila en la BD cambia el comportamiento del agente sin recompilar ni reiniciar nada.
- **6.2 AgentRegistry**: `Agent` (interfaz: `name()` + `tools(businessId)`), `SalesAgent` (envuelve `SalesTools`), `AgentRegistry` (agrega los tools de todos los `Agent` registrados — Spring inyecta automáticamente `List<Agent>`). `AgentController` pide `agentRegistry.toolsFor(businessId)` en vez de listar tools a mano — sumar una capacidad nueva (stock, promos) es agregar una clase `@Component implements Agent`, sin tocar el controller.
- **Decisión de diseño (confirmada, discutida y re-confirmada dos veces)**: el "planner"/"Frontier" y el "ResponseAgent" del `.docx`/POC **no se replican como llamadas separadas al modelo** — el `ChatClient` de Spring AI ya resuelve selección de tool + ejecución + redacción de la respuesta final en un solo loop nativo.
  - Se evaluó explícitamente separar esto en un **Frontier** (modelo único/global que evalúa intención + decide qué agente(s) corresponden, con salida estructurada, permitiendo cortar temprano si la pregunta no aplica y soportando multi-agente explícito) + **Orchestrator** en Java (dispatch determinístico) + **ResponseAgent** separado. Se descartó — el mismo multi-tool-calling y el mismo "no tengo herramienta para eso" ya salen gratis del `ChatClient` nativo con todas las tools del `AgentRegistry` bindeadas juntas (el modelo puede llamar más de una tool en el mismo turno si hace falta), sin necesitar una decisión estructurada previa. Separarlo cuesta 2-3x más llamadas al LLM por turno, más código, y un riesgo real de que un paso de "redacción" posterior distorsione un dato ya resuelto correctamente — sin beneficio comprobado sobre lo que ya devuelve la llamada única.
  - Si en el futuro aparece una necesidad concreta que el `ChatClient` nativo no pueda resolver bien (ej. el catálogo de tools crece mucho y el modelo empieza a confundirse eligiendo cuál usar, o hace falta auditar/loguear la intención detectada como dato estructurado), ahí se reevalúa con ese caso real en mente — no antes.

**✅ Prueba (hecha):** con la BD (`ai_prompts` aplicada), "¿cuánto se vendió hoy?" con `locale:"es"` → responde en español, con datos reales, vía el `AgentRegistry`. Mismo resultado que la Fase 4, ahora servido a través del registry.

---

## Fase 7 — Memoria (ChatMemory) ✅ (completada)

**Objetivo:** contexto entre turnos (lo que la rama v1 no tenía).

- **7.1** `MemoryConfig` → bean singleton `ChatMemory` (`MessageWindowChatMemory`, in-memory — se pierde al reiniciar el proceso; persistente queda para hardening posterior). `AgentController` lo agrega como `.defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())` y pasa `conversationId` vía `.advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))`. v1: `conversationId` viaja explícito en el request (`request.conversationId()`, con fallback al `businessId`) — la sesión real por usuario del widget llega en la Fase 9.

**✅ Prueba (hecha):** turno 1 "¿cuánto se vendió hoy?" → turno 2 "¿y a cuánto asciende el ticket promedio **de eso**?" con el mismo `conversationId` → el agente resolvió correctamente la referencia al turno anterior sin que se le repitiera el contexto.

---

## Fase 8 — Proveedores cloud + gating por plan cableado ✅ (completada)

**Objetivo:** cerrar el circuito de config de modelos.

**Decisión de producto (ajustada durante la implementación)**: las API keys de proveedores cloud **no** viven en env/secret del servicio Spring como decía el plan original — viven **cifradas en `ai_models.api_key`** (AES-256-GCM, `backend/src/common/utils/secret-crypto.ts`, clave de cifrado en `AI_MODELS_ENCRYPTION_KEY`), editables desde `/ai-models` sin redeploy. Nunca se devuelven en texto plano vía API (`AiModelResult` solo expone `has_api_key: boolean`); solo se desencriptan en el canal server-to-server (`GET /ai-chat/runtime-config`, `InternalTokenGuard`), que ahora incluye `apiKey` en la respuesta.

- **8.1 NestJS**: migración `063` agrega `ai_models.api_key` (texto cifrado). `AiModelsService.create/update` cifran al guardar; `RuntimeConfig`/`getRuntimeConfigForBusiness`/`getDefaultRuntimeConfig` desencriptan y devuelven `apiKey`. Formulario de `/ai-models` (`AiModelModal`) suma un campo de key (`Input.Password`, nunca precargado — "vacío = no cambiar" en edición).
- **8.2 Spring**: `build.gradle.kts` suma `spring-ai-starter-model-anthropic` y `spring-ai-starter-model-openai` (este último cubre tanto OpenAI real como "openai_compatible" — Qwen cloud, DeepSeek, etc. vía `base_url` propio). Nuevo `ChatModelFactory` (`config/ChatModelFactory.java`) centraliza la construcción del `ChatModel` según `cfg.provider()` (`ollama` → `OllamaChatModel`, `anthropic` → `AnthropicChatModel`, `openai`/`openai_compatible` → `OpenAiChatModel`) — `AgentController` y `ChatController` ya no hardcodean Ollama, delegan al factory.
- **8.3 Fix arranque**: sumar los starters de Anthropic/OpenAI activa la autoconfiguración por defecto de Spring Boot para esos providers (intenta armar `ChatModel`/`AudioSpeech`/`AudioTranscription`/`Embedding`/`Image`/`Moderation` leyendo `spring.ai.*.api-key` de `application.yml`) — como no la usamos (`ChatModelFactory` arma todo a mano, por request, con la key que resuelve NestJS), el arranque fallaba con `BeanCreationException`. Se excluyen las 7 autoconfiguraciones explícitamente en `AiOrchestratorApplication`.
- **8.4 Fix fechas relativas**: un modelo local chico (`qwen2.5:3b-instruct`) no tiene noción propia de "hoy" — al preguntar "¿cuánto vendí ayer?" inventó una fecha de 2023, y luego rechazó consultar agosto 2026 por creerlo "futuro". `AgentController.buildDateContext()` calcula la fecha real (hora Bolivia, mismo criterio que `timezone.ts`) en cada request y la concatena al system prompt — no se guarda en `ai_prompts` (es dinámica, no contenido estático).

**✅ Prueba (hecha por el usuario)**: fix de fechas relativas (ayer/agosto) confirmado con `qwen2.5:3b-instruct` (local). Proveedor cloud confirmado end-to-end con una API key real de **DeepSeek** (`provider: openai_compatible`, `base_url` propio) — mismo `OpenAiChatModel` del `ChatModelFactory`, sin código nuevo.

---

## Fase 9 — Frontend → proxy NestJS → Spring + enforcement de cuota ✅ (completada, fusionada con 0.5)

**Objetivo:** el widget del panel funciona end-to-end y la plataforma controla costo.

- **9.1 Spring** — `AgentController.chatWithTools` pasó de `.call().content()` a `.call().chatResponse()` para extraer `promptTokens`/`completionTokens` de `ChatResponse.getMetadata().getUsage()`; nuevo record `ToolChatResponse(model, baseUrl, reply, promptTokens, completionTokens)`.
- **9.2 NestJS** — `POST /ai-chat/message` (`ai-chat.controller.ts`, `JwtAuthGuard` normal, no `InternalTokenGuard`) → `AiChatProxyService`:
  1. Verifica `enabledModules.aiChat` del negocio del usuario (mismo patrón de merge que `/auth/me`) — `ForbiddenException` si está apagado.
  2. `AiChatQuotaService.checkAndIncrement(businessId)` — `ForbiddenException` con el mensaje del plan si `allowed:false`.
  3. Toma el último mensaje `role:"user"` del array `messages` (la memoria de turnos la mantiene la `ChatMemory` de Spring, no hace falta reenviar el historial completo) y llama `POST {AI_ORCHESTRATOR_URL}/chat/tools` con `conversationId = businessId:userId` (aísla la memoria por usuario admin, no solo por negocio).
  4. `AiChatQuotaService.addTokenUsage(businessId, promptTokens, completionTokens)` con los tokens reales que devolvió Spring.
  - Nueva env var `AI_ORCHESTRATOR_URL` (default `http://localhost:8090`) en `.env`/`.env.example`.
- **9.3 Frontend** — mismo contrato que la rama vieja: `sendChatMessage(messages, locale)` → `{ content }`.

**✅ Prueba (hecha):** con backend + Spring + Ollama levantados, `POST /ai-chat/message` con un JWT real de un negocio con `aiChat:true` → respuesta correcta, y `ai_chat_usage` del día quedó con `messageCount:1` y los `inputTokens`/`outputTokens` reales devueltos por Spring. Validado también en el navegador por el usuario: el widget aparece y responde.

---

## Fase 10 — Más agentes y hardening (posterior)

- Sumar más tools (stock/alertas, top-products, promos, productos) — evaluar en ese punto si conviene automatizar la derivación desde OpenAPI (`/api-docs-json`) + un allowlist propio, en vez de seguir agregando clases `@Tool` a mano una por una.
- Sumar agentes (Purchase, Inventory…) al registry; tool de branches para resolver nombre→UUID; memoria persistente; secret manager para keys cloud; actualizar `chat-ia-que-preguntar.md`.

**✅ Prueba:** por agente/mejora, su propio caso real.

---

## Verificación global

- Cada fase tiene su gate propio (arriba) — no se avanza sin validar la anterior.
- Backend/front: `npx tsc --noEmit` en `backend/` y `frontend/` tras cada fase NestJS.
- Servicio Spring: `./gradlew test` + `bootRun` con prueba manual del flujo.
- Cierre v1: desde el panel admin, una batería de preguntas reales (ventas, top-products, stock, promos, productos) contra un negocio Básico (local) y uno Pro (cloud), confirmando datos reales, memoria de sesión, cuota y aislamiento de carga IA del backend.

## Decisiones que quedan para resolver dentro del plan
- Formato exacto de `allowed_models` en `limits` (lista de model-ids vs. de providers).
- Dónde persisten las keys centralizadas en prod (env vs. secret manager) — v1 usa env.
- Si el negocio puede apuntar a su propio Ollama (baseURL propia) o siempre el de la plataforma.

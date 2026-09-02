# Evaluación: qué extraer (concepto) para el servicio de chat-ia en Spring AI

## Contexto

Se quiere construir el chat-ia como un **servicio Spring AI (Java) separado** (`docs/features/chat-ia-backend/arquitectura_spring_ai_nestjs.docx`), con NestJS como backend de negocio/datos y Ollama+Qwen como servidor de inferencia. Motivación: **escalado independiente** (aislar la carga de IA del backend de negocio).

**El target es Spring AI (Java)**, así que ni la rama ni el POC aportan código migrable — **son fuentes de concepto**. Hay dos, y son complementarias:

1. **Rama `feature/chat-ia-agente-admin`** (NestJS/TS, ~3.500 líneas, completa y funcional): aporta el concepto de **ejecución segura de tools sobre datos reales** + los **activos que se quedan del lado NestJS**.
2. **POC `tutorials/agent-orchestrator-step1`** (Node/TS, sketch): aporta el concepto de **flujo de orquestación multi-agente** (planner → registry → agentes → response) que se adaptaría a Spring AI.

Este archivo es una **evaluación**, no un plan de construcción, y **no fija el alcance de v1** (queda para el plan posterior). El objetivo es dejar mapeado qué se aprovecha de cada fuente cuando se empiece con Spring AI.

---

## 1. Las dos fuentes de concepto (se complementan)

### Rama = las "tripas" de ejecución segura
Pipeline: `POST /ai-chat/message → Orchestrator → QueryAgent → loop [complete() ↔ tools]`, donde las tools salen de **OpenAPI (solo GET) + allowlist** y el executor **firma un JWT propio del agente y hace fetch HTTP real** contra los endpoints del backend. Un solo agente, **stateless**. Datos **reales**.

### POC = la "cáscara" de orquestación (el flujo que se quiere)
`DB simulada → AgentRegistry (RAM) → memoria RAM → planner (Qwen JSON)`:
- **Planner**: recibe el mensaje + capacidades disponibles → devuelve `{action, parameters}` (JSON).
- **AgentRegistry**: `Map` cargado de una "DB de agentes" (hoy simulada) → rutea la acción al agente que la tiene.
- **SalesAgent**: agente especializado que usa tool-calling (Ollama) para su tarea.
- **ResponseAgent**: convierte el resultado crudo en lenguaje natural.
- Datos **simulados** (getSalesReport devuelve hardcodeado — justo la parte que la rama sí resuelve de verdad).

### La síntesis
El diseño objetivo = **cáscara del POC (planner → registry → agentes especializados → response + memoria) + tripas de la rama (tools OpenAPI+allowlist, identidad propia, HTTP real, cuotas, lecciones)**. En Spring AI, la cáscara la dan sus abstracciones nativas (ChatClient, agentes, ChatMemory) y las tripas se reimplementan guiadas por la rama.

---

## 2. Conceptos a llevar a Spring AI (blueprint)

### 2.1 Del flujo de orquestación (POC + .docx)
- **Planner/router** que decide una acción antes de ejecutar (en la rama no hay: un solo agente resuelve todo con el tool loop). Para pocas tools puede ser overkill; con multi-agente se vuelve necesario.
- **Registry de agentes cargable de datos** (no hardcodeado) — permite sumar agentes (Purchase, Inventory…) sin reescribir el router. El `.docx` lo dibuja como SalesAgent / …Agent / ResponseAgent.
- **ResponseAgent separado** (formatea la salida) como paso final del pipeline.
- **Memoria de sesión/contexto** — **requisito de primer nivel**, presente en POC (memoria RAM) y en el `.docx` (Session Manager + Context Manager). Es lo que la rama v1 **no** tiene. En Spring AI → `ChatMemory` (in-memory o persistente).

### 2.2 De la ejecución segura de tools (rama) — decisiones ya validadas
1. Config de IA **independiente** de la del bot de Telegram (keys `ai_chat_*`).
2. **Documentar todo el backend con OpenAPI** — es el insumo del que salen las tools.
3. **v1 solo tools de lectura (GET)**.
4. **Tools por HTTP real contra los endpoints** (no llamadas a services) → pasa por los mismos guards, no duplica autorización, y **es lo que hace el diseño portable a otro servicio**.
5. **Identidad de auth propia del agente**, no la del usuario que abre el chat.

### 2.3 Modelo de seguridad en dos capas (rama)
- **Allowlist explícito de `operationId`s** (`allowed-operations.ts`): si no está en la lista, el agente no sabe que el endpoint existe. Curado a mano.
- **JWT de vida corta del agente** (2 min), con `business_id` del dueño de la key — acota el blast radius.

### 2.4 Lecciones operativas ya pagadas (evitan re-tropezar en Java)
- **Loop de tools acotado** (máx. 4 iteraciones) → sin loops infinitos.
- **Modelos locales chicos (Qwen 3-4B) alucinan parámetros**: dropear UUIDs mal formados antes de mandarlos; esperar peor selección de tool que Anthropic/GPT. **Validar tool-calling de Ollama/Qwen antes de confiar** — es el mayor riesgo del enfoque local, y el POC lo usa (Ollama `qwen2.5:3b-instruct`).
- **Filtro por sucursal**: el modelo no resuelve "sucursal Centro" → UUID; conviene una tool de branches para resolver nombre→UUID (ya está `BranchesController_list` en el allowlist).
- **Fechas explícitas** > relativas.
- **Bounding del error body** (500 chars) devuelto al modelo.
- **Registrar gasto de tokens aunque una iteración falle** (el costo ya ocurrió).

### 2.5 Set de tools de v1 (qué exponer)
`allowed-operations.ts`: stock/alertas/movimientos, reportes (ventas, top-products, daily, cashiers, orders), promociones, productos, sucursales, categorías. **Porta directo como configuración del nuevo servicio.**

### 2.6 Ollama/Qwen sin código especial
Se habla vía API OpenAI-compatible (`http://host:11434/v1`). El POC ya lo hace con la librería `ollama` y con `openai` apuntando a DashScope. En Spring AI → starter de Ollama o de OpenAI con baseURL de Ollama.

---

## 3. Activos que quedan en NestJS y se reusan **sin reescribir** (no son concepto: son código que permanece)

Aunque el orquestador sea Java, esto vive en el backend NestJS y se reutiliza tal cual:

| Activo | Estado | Nota |
|---|---|---|
| **Capa Swagger/OpenAPI** (backend documentado) | ✅ Reusar tal cual | **Prerrequisito duro**: Spring deriva las tools de acá vía `GET /api-docs-json`. |
| **`allowed-operations.ts`** | ✅ Reusar como dato/config | Lista curada de operationIds seguros. |
| **Planes/cuotas/uso** (`ai-chat-plans/`, `ai-chat-usage/`, schema Prisma, migraciones `056`/`057`) | ✅ Queda en NestJS | Spring consulta cuota antes y reporta uso después (§5). El `limits` JSON del plan **también gatea qué modelos puede usar el negocio** (§6). |
| **Frontend** (`features/ai-chat/`, `features/ai-chat-plans/`) | ✅ Mayormente reusable | Contrato `POST /ai-chat/message → {content}` preservable con proxy en NestJS. |
| **Docs** (`chat-ia-que-preguntar.md`, plan original) | ✅ Reusar | Guía de uso y racional. |

---

## 4. Qué se construye de cero en Java/Spring AI (mapeo)

| Concepto (rama TS / POC TS) | Equivalente Spring AI |
|---|---|
| Providers (Anthropic / OpenAI-compat / Ollama con tool-calling) | `ChatModel`/`ChatClient` nativos (starters) |
| `tool-registry` (OpenAPI + allowlist → tools) | Tool/function calling de Spring AI + mapper OpenAPI→ToolCallback (nuevo, Java) |
| `tool-executor` (JWT propio + fetch HTTP) | `@Tool`/`ToolCallback` + `WebClient` hacia NestJS |
| `orchestrator`/`query-agent` (loop) + **planner/registry del POC** | `ChatClient` + advisor chain / orquestación multi-agente de Spring AI |
| SalesAgent / ResponseAgent (POC + .docx) | Agentes Spring AI especializados |
| **Memoria RAM (POC) / Session+Context Manager (.docx)** | **`ChatMemory`** — pieza nueva, ausente en la rama |

---

## 5. Seams cross-service y concerns nuevos (por separar el servicio)

Seams ya identificados por la rama:
1. **OpenAPI**: in-memory hoy → Spring hace `fetch GET /api-docs-json` al boot.
2. **JWT del agente**: hoy reusa `JwtService`/`JWT_SECRET` in-process → separado, decidir **JWT_SECRET compartido** vs. **endpoint emisor de token acotado** en NestJS.

Concerns nuevos (no están en la rama porque era in-process):
- **Cuota/uso**: hoy `QueryAgentService` llama `checkAndIncrement`/`addTokenUsage` in-process → Spring debe consultar/reportar vía endpoints NestJS, o NestJS actúa de proxy y hace el enforcement.
- **Modelo + credenciales**: las API keys cloud son **centralizadas de plataforma** (superadmin), no BYO del negocio; el modelo se **deriva del plan** del negocio. Spring pide a NestJS "qué modelo usar para este negocio" y la plataforma le inyecta la key (env/secret), nunca viaja del frontend ni del negocio (§6).
- **Topología**: el `.docx` mete Nginx. Definir si el frontend habla con Spring directo o vía proxy NestJS (**recomendado el proxy**: preserva contrato, auth y cuotas).
- **Memoria/contexto**: dónde vive (RAM del servicio Spring vs. tabla).

---

## 6. Configuración de modelos por plan + credenciales centralizadas (superadmin)

> **Decisiones tomadas:** el catálogo de modelos se **gatea por plan** (reusando el `limits` JSON de `ai_chat_plans`, sin migración) y las **API keys de proveedores cloud son centralizadas de la plataforma** (las configura el superadmin una vez; el negocio no las ve ni las carga).

### Estado en la rama vs. lo que se quiere
- **Hoy (rama)**: el modelo lo elige el **admin del negocio** de una lista hardcodeada en frontend (`MODEL_VALUES`/`getModels`), y cada negocio **trae su propia API key** (BYO) en Settings → Chat IA. El superadmin solo controla el flag on/off (`enabled_modules.aiChat`) y las cuotas (planes).
- **Se quiere**: el **superadmin** define, **por plan**, qué modelos/proveedores puede usar el negocio (local y/o cloud); las **keys las pone la plataforma**.

### Diseño
- **Gating por plan**: extender el `limits` JSON de `ai_chat_plans` con `allowed_models` (o `allowed_providers`) — ej. `Básico → ["qwen-local"]`, `Pro → ["qwen-local","claude-haiku","gpt-4o-mini"]`, `Ilimitado → [*]`. **Sin migración** (la columna ya es JSON extensible por diseño).
- **Catálogo = data, no hardcode**: mover `MODEL_VALUES`/`getModels` a algo controlado por el superadmin; el dropdown de modelo del admin se **restringe** al subset que su plan habilita.
- **Keys centralizadas**: las `ai_chat_*_api_key` dejan de vivir en `AppSetting` por-negocio → pasan a config de plataforma (superadmin). El form de Settings del admin **ya no pide API keys**; a lo sumo elige el modelo permitido por su plan.
- **Local vs cloud**: planes **local-only** (Ollama, costo ~cero, corre en infra de la plataforma) vs planes **con cloud** (la plataforma paga Anthropic/OpenAI/Qwen). Como la plataforma absorbe el costo cloud, **las cuotas (ya en la rama) pasan a ser el control de costo real**.

### Feature-flag (regla del proyecto)
- **Ámbito**: por **plan** (agrupa negocios), gestionado por el superadmin en `/ai-chat-plans` — extender `AiChatPlanModal` con la selección de modelos permitidos.
- **Default**: plan Básico → local-only.
- **No hardcodear** el catálogo de modelos en frontend.

### En el servicio Spring AI
- El orquestador **resuelve modelo + credenciales según el plan del negocio** (consulta a NestJS), no según config libre del negocio. Las keys las **inyecta la plataforma** en el servicio Spring (env/secret manager); nunca viajan desde el frontend ni desde el negocio.

---

## 7. Recomendación de la evaluación

- **Lo de mayor valor no es código sino: (a) la capa OpenAPI + allowlist + lecciones operativas (§2.3–2.4) de la rama, y (b) el flujo de orquestación (planner → registry → agentes → response + memoria) del POC.** Lo primero vive en NestJS o es diseño; lo segundo lo dan las abstracciones nativas de Spring AI.
- **Todo lo de datos/negocio (planes, cuotas, uso, frontend) se queda en NestJS** y se reutiliza; Spring se integra vía HTTP.
- **El runtime del agente se reescribe en Spring AI**, guiado 1:1 por el pipeline de la rama y el flujo del POC — no se parte de cero conceptualmente.
- **Antes de construir: spike de tool-calling en Spring AI + Ollama/Qwen** — confirmar la lección §2.4 (los modelos locales chicos fallan seguido en tool selection). Es el mayor riesgo técnico del enfoque local, y tanto la rama como el POC ya lo señalan.

---

## 8. Decisiones abiertas (para el plan de construcción posterior)

Ya decididas: **catálogo de modelos por plan** (reusa `limits` JSON) y **keys cloud centralizadas de plataforma** (§6). Quedan abiertas:

1. Frontend → Spring directo o → NestJS proxy → Spring (recomendado proxy).
2. Auth del agente: `JWT_SECRET` compartido vs. endpoint emisor en NestJS.
3. Cuota/uso: endpoints nuevos en NestJS que Spring consume vs. enforcement en el proxy.
4. Memoria: in-memory del servicio vs. persistente (tabla).
5. Alcance v1 (no fijado acá): ¿arrancar single-agent como la rama y sumar el multi-agente del POC en fase 2, o multi-agente desde el inicio? — a decidir en el plan.
6. **Dónde viven las keys centralizadas**: env/secret manager del servicio Spring vs. tabla de settings del superadmin en NestJS.
7. **Migración de las keys BYO** que hoy tienen los negocios en `AppSetting` (¿se descartan, o se respetan como fallback en transición?).
8. **¿El negocio puede apuntar a su propio Ollama local** (baseURL propia) o el endpoint local es siempre el de la plataforma?

---

## Verificación de esta evaluación

- Confirmar con el usuario que el mapeo §3/§4 (qué queda en NestJS vs. qué se reescribe en Spring) y la síntesis "cáscara del POC + tripas de la rama" reflejan su intención.
- Al existir el servicio Spring: probar el flujo end-to-end (pregunta real → planner rutea → agente ejecuta tool real → ResponseAgent formatea → memoria persiste el turno), replicando el criterio del plan original más el eje nuevo (carga de IA aislada del backend).

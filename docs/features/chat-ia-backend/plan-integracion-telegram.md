# Plan — Chat IA vía Telegram (bot propio por negocio)

## Contexto

Cada negocio va a poder registrar **un único bot de Telegram** (creado con
@BotFather) más **un chat o grupo autorizado** (su `chat_id`), y desde ese
mismo registro elegir con dos switches independientes qué quiere usar:

- **Notificaciones** — avisos salientes de pedidos (ya existe hoy).
- **Chat IA** — poder escribirle al bot ("dame las ventas de ayer") y recibir
  la misma respuesta que le daría el widget de chat-ia en el panel web —
  mismas tools, mismo LLM, mismo `ai-orchestrator` (`services/ai-orchestrator`).

Los dos pueden estar prendidos a la vez (mismo bot sirve para ambas cosas),
solo uno, o ninguno. No son features en conflicto: notificaciones es
puramente saliente (nunca necesita webhook), chat-ia es entrante (necesita
webhook). Un mismo bot puede hacer las dos cosas sin pisarse.

Flujo end-to-end del lado chat-ia:

```
Telegram → webhook (NestJS) → AiChatProxyService → ai-orchestrator (Java, tools + LLM)
                                                            │
Telegram ← TelegramSenderService (NestJS) ←────────────────┘
```

El `ai-orchestrator` nunca sabe que existe Telegram — sigue recibiendo
`{ businessId, role, conversationId, message }` y devolviendo texto, igual
que hoy para el widget web. Todo lo específico de Telegram (webhook, tokens,
envío de mensajes) vive en el backend NestJS.

Documentos relacionados: `catalogo-tools.md` (las 22 tools existentes),
`plan-desarrollo-spring-ai.md` (arquitectura del orchestrator), `CLAUDE.md`
(regla de "una feature a la vez, validar antes de seguir").

---

## Qué existe hoy (y por qué no alcanza tal cual)

Bajo "Telegram" conviven hoy **dos features ya construidas**, distintas entre sí:

| | Notificaciones (hoy) | Bot de reportes (hoy) |
|---|---|---|
| Dirección | Solo saliente | Entrante (webhook) |
| Inteligencia | Ninguna — mensaje de plantilla | LLM simple, parsea intención, sin tools reales |
| Multi-tenant | Sí — `app_settings` por `businessId` | **No** — resuelve "el primer negocio" a mano |
| Dónde vive | `backend/src/notifications/telegram-notification.service.ts` | `backend/src/telegram/` (`telegram-ai.service.ts` + webhook global + `TelegramAuthorizedChat`) |
| Config | `app_settings`: `telegram_bot_token`, `telegram_chat_id`, `telegram_enabled` | Settings globales + tabla `telegram_authorized_chats` (sin `business_id`) |

Notificaciones ya es multi-tenant y reutilizable tal cual — su config
(`telegram_bot_token`/`telegram_chat_id`/`telegram_enabled`) es exactamente
lo que necesita chat-ia también, solo que en una tabla con más columnas
(secretos de webhook, dos toggles en vez de uno).

El bot de reportes viejo **no** es la base para esto: es un único bot
global compartido por todos los negocios, sin tools reales, con un bug de
diseño conocido (asume un solo negocio). Se deja fuera de este plan — más
abajo, en decisiones pendientes.

---

## Decisiones fijadas

- **Config unificada, un solo formulario.** Se reemplaza el `app_settings`
  actual de notificaciones por una tabla dedicada `TelegramBotConfig`, con
  **un registro por negocio** y **dos switches independientes**:
  `notificationsEnabled` y `chatIaEnabled`. El admin registra el bot una
  sola vez (token + chat_id) y prende lo que necesite. Puede tener ambos, uno
  solo, o ninguno (bot registrado pero inactivo).
- **Migración de lo existente**: los negocios que ya usan notificaciones
  tienen sus 3 keys en `app_settings`. Migración de backfill: por cada
  negocio con `telegram_bot_token`/`telegram_chat_id` seteados, crear su fila
  en `TelegramBotConfig` con `notificationsEnabled = (telegram_enabled ===
  'true')` y `chatIaEnabled = false` (preserva el comportamiento actual, no
  activa nada nuevo solo). Las keys viejas de `app_settings` se dejan
  intactas hasta confirmar que todo funciona con la tabla nueva — se limpian
  en un paso aparte, no en esta misma migración.
- **`telegram-notification.service.ts` pasa a leer de la tabla nueva**, no de
  `app_settings` — una sola fuente de verdad para el bot token/chat_id de un
  negocio. Cambio mínimo (una query Prisma en vez de otra), sin tocar la
  lógica de envío.
- **El adaptador de chat-ia va en el backend NestJS, no en el
  `ai-orchestrator`.** El orchestrator queda agnóstico al canal (a propósito,
  ver `plan-desarrollo-spring-ai.md` Fase 6). Todo lo de Telegram (webhook,
  tokens, secretos, envío) es responsabilidad de NestJS, igual que hoy
  `AiChatController` es la puerta de entrada del widget web.
- **Se reutiliza `AiChatProxyService.sendMessage` completo**
  (`backend/src/ai-chat/ai-chat-proxy.service.ts:31`) — chequeo de flag
  `enabledModules.aiChat`, cuota diaria (`AiChatQuotaService`), resolución de
  sucursal, y la llamada a `/chat/tools` del orchestrator. Cero lógica
  duplicada: el adaptador de Telegram solo arma el `CurrentUserPayload` y el
  `SendMessageDto`, y llama al mismo método que ya usa el widget.
- **Identidad: se reutiliza el patrón "agente por negocio" que ya existe**
  (`AgentIdentityService.findOrCreateAgentProfile`,
  `backend/src/ai-chat/agent-identity.service.ts:36`), en vez de inventar un
  mecanismo nuevo. Se agrega un método público (`getOrCreateAgentProfile`,
  sin firmar JWT — el adaptador llama a `AiChatProxyService` in-process, no
  por HTTP) que devuelve el `Profile` sintético `admin` de ese negocio. Con
  eso se arma el `CurrentUserPayload` que pide `sendMessage`.
- **`conversationId` sale gratis**: `AiChatProxyService` ya arma
  `${businessId}:${userId}` (línea 111). Como el agente sintético tiene un
  `id` fijo por negocio, la conversación de Telegram mantiene memoria
  continua entre turnos sin ningún esquema especial.
- **Un bot por negocio ⇒ un webhook por negocio, solo si `chatIaEnabled`.**
  Telegram no manda el bot token en el payload del update, así que la URL
  tiene que identificar al negocio. Se usa un `webhookToken` random,
  generado solo cuando se activa chat-ia (no el UUID del negocio, para no
  exponerlo/enumerarlo en una URL pública):
  `POST /telegram-config/webhook/:webhookToken`. Si el negocio solo usa
  notificaciones, nunca se llama `setWebhook` — no hace falta recibir nada.
- **Triple validación en el webhook**: (1) el `webhookToken` del path resuelve
  la config del negocio, (2) header `X-Telegram-Bot-Api-Secret-Token`
  (mecanismo nativo de Telegram) contra un secret guardado por negocio, (3) el
  `chat.id` del update tiene que matchear el chat/grupo autorizado guardado —
  si alguien más le escribe al bot (aunque conozca el token), se ignora en
  silencio.
- **Se reutiliza `TelegramSenderService.sendMessage(botToken, chatId, text)`**
  (`backend/src/telegram/telegram-sender.service.ts:5`) tal cual — ya es
  genérico, recibe el token por parámetro, no depende de un negocio fijo.
  Sirve tanto para notificaciones como para las respuestas de chat-ia.
- **Sin flag de módulo nuevo para chat-ia**: alcanza con `enabledModules.aiChat`
  (ya existe, ya lo chequea `AiChatProxyService.sendMessage`) + el
  `chatIaEnabled` de la fila de config. Si el negocio no tiene `aiChat`
  habilitado a nivel plataforma pero prendió el switch igual, el webhook
  responde con un mensaje explicando que el chat IA no está habilitado — no
  un error silencioso. Notificaciones sigue gateada por `enabledModules.telegram`
  como hoy.

### Decisiones pendientes (fuera de alcance de este plan)

- **Qué hacer con el bot de reportes viejo** (`backend/src/telegram/telegram-ai.service.ts`,
  `TelegramAuthorizedChat`, webhook global). No se toca en este plan. Es
  candidato a deprecarse una vez el chat-ia por Telegram esté validado —
  hace un subconjunto de lo mismo, con el bug de "un solo negocio". Se
  decide en una iteración aparte.
- ~~**Nombre final del módulo/tabla**~~ — resuelto en Fase 2/3: el CRUD
  autenticado quedó en `SettingsService`/`SettingsController` (extendiendo
  `GET/PUT /settings`, no un módulo nuevo), y el webhook público quedó en
  `backend/src/telegram-chat-ia/`. `TelegramBotConfig` es el nombre final de
  la tabla. `frontend/src/features/telegram-bot/` (bot viejo) queda sin
  tocar.

### Fuera de alcance (v1)

- WhatsApp — mucho más lift (Meta Business API, aprobación, plantillas
  pre-aprobadas para mensajes salientes). Fase futura si el negocio lo pide.
- Múltiples chats/grupos autorizados por negocio — v1 es uno solo (comparte
  el mismo chat para notificaciones y para chat-ia).
- Roles distintos según quién escribe dentro del chat autorizado — todo el
  que escribe en ese chat/grupo actúa como `admin` (igual que hoy el chat
  del panel web solo distingue `admin`/`cajero` por el JWT de quien abrió el
  widget; acá no hay JWT individual, el chat entero *es* la sesión admin).

---

## Fase 1 — Modelo de datos + migración de lo existente

- **Migración** `docs/database/migrations/067_telegram_bot_config.sql`
  (siguiente número libre tras `066`).
- **Prisma model** `TelegramBotConfig`:
  - `id` (uuid, pk)
  - `businessId` (uuid, único — un registro por negocio)
  - `botToken` (string)
  - `chatId` (string — el chat/grupo autorizado, compartido por ambas features)
  - `chatType` (`'private' | 'group'`)
  - `notificationsEnabled` (boolean, default `false`)
  - `chatIaEnabled` (boolean, default `false`)
  - `webhookToken` (string, único, nullable — solo existe si `chatIaEnabled` estuvo activo alguna vez)
  - `webhookSecret` (string, nullable, mismo criterio)
  - `isActive` (boolean, default `true` — kill switch general)
  - `createdAt` / `updatedAt`
- **Backfill en la misma migración**: por cada `business_id` con
  `telegram_bot_token` y `telegram_chat_id` en `app_settings`, insertar una
  fila en `telegram_bot_config` con `notifications_enabled = (telegram_enabled = 'true')`
  y `chat_ia_enabled = false`. No borra las keys viejas de `app_settings`.

**✅ Prueba:** tras aplicar la migración, un negocio que ya tenía
notificaciones configuradas aparece con su fila en `TelegramBotConfig` y
`notificationsEnabled` en el mismo estado que tenía antes (`prisma studio`
o `SELECT` directo).

---

## Fase 2 — Backend: unificar notificaciones sobre la tabla nueva ✅ (completada)

**Objetivo:** antes de sumar nada de chat-ia, dejar notificaciones
funcionando igual que hoy pero leyendo de `TelegramBotConfig` — así el
riesgo de romper algo que ya funciona en producción se prueba y valida
aislado, sin mezclarlo con la feature nueva.

**Ajuste sobre el plan original**: no se creó un módulo `telegram-config`
nuevo para el CRUD autenticado — se extendió `SettingsService`/`SettingsController`,
que ya era dueño de `telegram_bot_token`/`telegram_chat_id`/`telegram_enabled`
dentro de `GET/PUT /settings` (mismo endpoint que usa `TelegramSettingsForm.tsx`
para *todas* las pestañas de settings, no solo Telegram). Separarlo hubiera
significado dos fuentes de verdad conviviendo en el mismo formulario. El
único módulo nuevo real es el del webhook público (Fase 3), que sí es un
concern distinto (sin JWT, sin `RolesGuard`).

- `telegram-notification.service.ts`: lee `prisma.telegramBotConfig.findUnique({ where: { businessId } })`,
  chequea `isActive && notificationsEnabled`.
- `settings.service.ts`: `getSettings()`/`updateSettings()` leen/escriben
  `TelegramBotConfig` en vez de las 3 keys de `app_settings`. `updateSettings()`
  no crea una fila si el negocio nunca configuró un bot y guarda otra pestaña
  (bot_token es `NOT NULL`) — solo crea cuando llega un token real por
  primera vez; si ya existe la fila, solo actualiza.
- **Hallazgo no previsto, corregido en la misma fase**: el bot de reportes
  viejo (`telegram-webhook.controller.ts`) leía `telegram_bot_token` de
  `app_settings` para "el primer negocio" — dejaba de funcionar en cuanto
  `app_settings` dejara de recibir ese write. Se agregó
  `SettingsService.getFirstBusinessBotToken()` (mismo patrón "primer
  negocio") para que ese bot viejo siga andando sin cambios de comportamiento.

**✅ Prueba (hecha):** `tsc --noEmit` limpio, tests de `settings`/`notifications`/`telegram`
en verde (64/64). Pendiente que el usuario confirme en el navegador que un
negocio con notificaciones ya configuradas sigue viendo su token/chat_id en
Settings → Notificaciones.

---

## Fase 3 — Backend: activar chat-ia (config + webhook) ✅ (completada)

- `settings.service.ts`/`update-settings.dto.ts`/`settings-result.types.ts`:
  se sumó `chat_ia_enabled` al mismo `GET/PUT /settings` (no un endpoint
  nuevo). Al pasar de `false` a `true` por primera vez, `upsertTelegramBotConfig`
  genera `webhookToken`/`webhookSecret` (si no existían) y llama `setWebhook`
  de Telegram apuntando a `${BACKEND_PUBLIC_URL}/telegram-chat-ia/webhook/:webhookToken`
  con `secret_token: webhookSecret` — si Telegram lo rechaza (token
  inválido, `BACKEND_PUBLIC_URL` sin configurar), el `PUT /settings` falla
  con un error explícito en vez de dejar el switch "prendido" sin webhook de
  verdad. Al pasar de `true` a `false`, llama `deleteWebhook` (best-effort,
  no bloquea el guardado si falla — el controller del webhook ya no-opea con
  `chat_ia_enabled = false` de cualquier forma).
- **Nuevo módulo** `backend/src/telegram-chat-ia/` (deliberadamente
  independiente de `backend/src/telegram/`, que sigue siendo del bot viejo):
  - `telegram-chat-ia-webhook.controller.ts`: `POST /telegram-chat-ia/webhook/:webhookToken`
    (público, sin `JwtAuthGuard`).
  - `telegram-chat-ia-webhook.guard.ts`: resuelve `TelegramBotConfig` por
    `webhookToken`, valida `X-Telegram-Bot-Api-Secret-Token` contra
    `webhookSecret`, adjunta la config al `request`.
- Lógica del controller del webhook:
  1. Si `!config.chatIaEnabled` o `update.message.chat.id` no coincide con
     `config.chatId` → responder `200` sin hacer nada.
  2. Si corresponde → **responder `200` de inmediato** (Telegram tiene
     timeout corto y reintenta si no hay `200`; el LLM puede tardar varios
     segundos) y procesar el mensaje de forma asíncrona (fire-and-forget en
     v1; evaluar cola solo si da problemas de confiabilidad).
  3. Procesamiento async: `AgentIdentityService.getOrCreateAgentProfile(businessId, 'admin')`
     → arma `CurrentUserPayload` sintético → `AiChatProxyService.sendMessage(user, { messages: [{ role: 'user', content: text }], locale: 'es' })`
     → con la respuesta, `TelegramSenderService.sendMessage(config.botToken, config.chatId, reply)`.
  4. Si `AiChatProxyService` tira (`aiChat` deshabilitado a nivel
     plataforma, cuota agotada, orchestrator caído), capturar el error y
     mandar igual un mensaje legible al chat en vez de dejar al admin sin
     respuesta.

**✅ Prueba (parcial, hecha):** `tsc --noEmit` limpio; specs nuevos
(`telegram-chat-ia-webhook.controller.spec.ts`, `.guard.spec.ts`) cubren:
ignora si `chat_ia_enabled` es `false`, ignora updates sin texto, ignora
chats distintos al registrado, procesa el mensaje autorizado y responde con
el texto del orchestrator, y responde con un mensaje de error legible
(mensaje real de la excepción si es una `HttpException` como cuota agotada,
genérico si no) en vez de quedar mudo.

**Pendiente de validar por el usuario (requiere un bot real):** necesita
`BACKEND_PUBLIC_URL` seteado en el `.env` del backend (URL pública HTTPS
alcanzable por Telegram — en local, algo tipo ngrok) para que `setWebhook`
funcione. Con eso: registrar un bot en Settings, prender `chat_ia_enabled`,
y escribir "¿cuánto se vendió ayer?" en el chat/grupo autorizado debería
devolver la misma respuesta (con datos reales) que da el widget web para
ese negocio. Escribir desde otro chat no autorizado no debería generar
respuesta. Apagar `chat_ia_enabled` debería dejar de responder sin afectar
notificaciones.

---

## Fase 4 — Frontend: un solo formulario ✅ (completada)

- Reemplazar `TelegramSettingsForm.tsx` por un formulario único (mismo tab
  "Notificaciones" o uno renombrado "Bot de Telegram"): campo `botToken`
  (enmascarado tipo password), campo `chatId`, botón "Probar conexión", y
  **dos switches**: "Recibir notificaciones de pedidos" / "Habilitar chat
  con IA". El segundo switch solo aparece si `enabledModules.aiChat` está
  habilitado para el negocio.
- Copy inline con instrucciones: cómo crear un bot con `@BotFather`, cómo
  obtener el `chat_id` (agregar el bot a un grupo y usar `@userinfobot`, o
  mandarle un mensaje directo y leer la respuesta de `getUpdates`).
- Sigue gateado por `enabledModules.telegram` (como hoy) para mostrar la
  sección en absoluto; el switch de chat-ia además depende de
  `enabledModules.aiChat`.

**Ajuste sobre el plan original**: no se creó un tab nuevo — se mantuvo el
tab existente "Notificaciones" (`settings.tabs.notifications`, ya gateado por
`enabledModules.telegram`) y solo se actualizó el título/descripción de la
card (`settings.telegram.title/description`) para reflejar que ahora sirve a
ambas features. Cambiar el tab en sí era un rename más disruptivo sin
beneficio funcional.

`saveSettings`/`useSettings.handleSave` (frontend) también se ajustaron para
propagar el mensaje de error real del backend en vez de uno genérico — clave
para que el admin vea *por qué* falló activar `chat_ia_enabled` (token
inválido, `BACKEND_PUBLIC_URL` no configurado, etc.) en vez de un
"Error al guardar" sin contexto.

**✅ Prueba (hecha):** `tsc --noEmit` limpio en frontend. Pendiente que el
usuario confirme en el navegador: un admin puede pegar su token+chat_id,
prender el switch que quiera (uno, otro, o ambos), y ambas features
funcionan según lo que dejó prendido — sin tocar la base de datos a mano. El
switch de chat-ia solo debería aparecer si el negocio tiene `aiChat`
habilitado.

---

## Fase 5 — Hardening y validación final ✅ (completada, salvo limpieza futura)

- **Cuota compartida — verificado por lectura de código, sin cambios
  necesarios**: `AiChatQuotaService.checkAndIncrement` (`ai-chat-usage/ai-chat-quota.service.ts:22`)
  cuentra por `(businessId, date)` únicamente, sin ningún componente de
  usuario/canal. Como tanto el widget web como el webhook de Telegram
  convergen en el mismo `AiChatProxyService.sendMessage(user, dto)`, comparten
  el mismo contador estructuralmente — no hay forma de "duplicar" el límite
  abriendo el canal de Telegram.
- **Timeout + manejo de errores del orchestrator**: `AiChatProxyService.callOrchestrator`
  (`ai-chat/ai-chat-proxy.service.ts`) no tenía timeout — un orchestrator
  colgado (no caído, sino sin responder) dejaba la llamada esperando
  indefinidamente. Se agregó `AbortController` con 30s (cubre varias vueltas
  de tool-calling del `ChatClient` de Spring AI) y se envolvió toda la
  llamada en un try/catch que normaliza timeout/conexión rechazada/no-2xx al
  mismo `ForbiddenException` legible que ya se usaba — beneficia por igual al
  widget web y al webhook de Telegram (que ya capturaba y reenviaba ese
  mensaje al chat, Fase 3).
- **Secretos en logs — revisado, sin hallazgos**: ningún código nuevo
  (`telegram-chat-ia-webhook.controller.ts`, `settings.service.ts`) loguea el
  objeto de config completo ni el `botToken`/`webhookSecret`; los `catch`
  existentes loguean solo el error de `fetch` (mensaje genérico de Node, no
  incluye la URL con el token). No hay middleware global de logging de
  requests/headers que pudiera exponer el `X-Telegram-Bot-Api-Secret-Token`
  entrante.
- **`BACKEND_PUBLIC_URL`** documentado en `backend/.env.example` — requerido
  para que `setWebhook` funcione al activar `chat_ia_enabled`.

**✅ Prueba (hecha):** `tsc --noEmit` limpio, suite completa de backend sin
regresiones nuevas (362 tests, 350 en verde — los 12 que fallan son de
`products.service.spec.ts`/`orders.service.spec.ts`, preexistentes, no
relacionados a esta feature).

**Pendiente, no bloqueante (queda para cuando el usuario lo decida)**:
limpiar las keys viejas (`telegram_bot_token`/`telegram_chat_id`/`telegram_enabled`)
de `app_settings` en una migración aparte, una vez confirmado en producción
por un tiempo que nadie quedó leyendo de ahí.

# Mesero, mejoras POS y notificaciones (reunión cliente)

> [!note] Sin número asignado
> A diferencia de `docs/features/multitenant/` o `16-pos-promo-tab.md`, este feature todavía no tiene entrada en el tracker maestro (`pippo-project/features/{backlog,progressing,testing,done}/`) — vive solo acá por ahora. Si se quiere trackear ahí también, el próximo número libre es el 22.

## Estado

**En progreso.** Fase 0 (schema), Fase 1 (rol Mesero — auth), Fase 2 (flujo Mesero UI completo), Fase 3 (editar precio al vender), Fase 4 (cobro diferido), Fase 5 (ticket: mesa/mesero/notas), Fase 6 (robustez realtime + tablet polish), Fase 7 (identificar Pedidos Ya) y Fase 8 (notificaciones sonido/vibración) validadas. Solo queda la Fase 9 (Caja chica, baja prioridad). Ver `roadmap-fases.md` para el detalle fase por fase.

## Objetivo

Un rol nuevo de **Mesero** que permite tomar pedidos en mesa desde una tablet y mandarlos directo a cocina sin pasar por el cajero, más un paquete de mejoras alrededor de ese flujo: mesas, tipos de pedido (Delivery propio / Pedidos Ya), edición de precio al vender, cobro diferido, notificaciones sonoras/vibración, impresión enriquecida, y (baja prioridad) caja chica.

## Contexto

Salió de una reunión con el cliente — la fuente original son las notas en `docs/meet/new-features.md`. Es un paquete grande que toca casi todas las capas de la app (schema, 5+ módulos backend, 5+ features frontend, un rol de auth nuevo), así que se implementa como una serie de fases pequeñas y validables en vez de todo junto, siguiendo la regla del proyecto de "una feature a la vez, validar antes de seguir".

## Actores

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Mesero** *(nuevo)* | Personal de salón | Login compartido por sucursal (no cuenta individual). Tipea su nombre al entrar, ve el menú, elige mesa, crea pedidos con extras, ve sus propios pedidos y su estado. No cobra. |
| **Cajero** | Rol `cajero` actual | Ve los pedidos que los meseros crearon (mesa + nombre), los cobra cuando corresponde (inmediato o diferido), puede editar el precio de cualquier item al vender, marca pedidos como Pedidos Ya. |
| **Cocinero** | Rol `cocinero` actual | Ve los pedidos en tiempo real con mesa/mesero/tipo de pedido visibles, recibe alerta sonora al llegar un pedido nuevo. |

## Flujo end-to-end (confirmado)

Mesero crea pedido (sin cobrar) → llega a cocina automáticamente, sin aprobación del cajero, y en paralelo el cajero lo ve en su panel con mesa+mesero → cocina marca listo → el sistema notifica automáticamente a cajero **y** mesero al mismo tiempo (sin acción manual del cajero) → mesero lo retira, el cliente paga → cajero marca el pedido como cobrado. Ningún paso requiere aprobación/reenvío manual entre roles — todo es automático vía los eventos realtime que ya existen (`order:created`/`order:updated`).

## Alcance del MVP

**Incluye:**
- Rol Mesero con login compartido por sucursal (reutiliza el sistema de auth existente, no un mecanismo nuevo)
- Mesa como campo libre por pedido (sin catálogo administrable)
- 4 tipos de pedido: Local, Para llevar, Delivery (reparto propio, nuevo), Pedidos Ya (plataforma externa, carga manual — sin integración automática)
- Extras como modificador ligado a un item del carrito (no son productos del catálogo)
- Edición de precio al vender para cajero/admin, sobre cualquier item, sin motivo obligatorio
- Cobro diferido — un pedido puede existir sin cobrar y cobrarse después
- Notificaciones sonido + vibración, solo con el navegador/PWA abierto (sin Web Push)
- Impresión de ticket con mesa/mesero/notas
- Caja chica (baja prioridad, al final del roadmap)

**No incluye (por ahora):**
- Integración automática con la plataforma Pedidos Ya
- Notificaciones push con la app cerrada (Web Push real)
- Catálogo administrable de mesas
- Auditoría obligatoria de por qué se editó un precio

## Decisiones ya tomadas

- **Mesero (auth):** perfil `role: 'mesero'` compartido por sucursal (como cajero/cocinero hoy), no una cuenta por persona. Al entrar, el mesero tipea su nombre (sin contraseña) y ese nombre queda activo en el dispositivo hasta que alguien lo cambia con un botón visible "Cambiar de mesero". Pueden existir varias tablets activas a la vez en la misma sucursal, cada una con su propio nombre activo.
- **Mesas:** campo libre (`table_number` texto), no catálogo.
- **Editar precio al vender:** habilitación general para cajero/admin sobre cualquier item, no exclusiva a Pedidos Ya. El campo `notes` existente sirve como bitácora informal opcional.
- **Tipos de pedido:** 4 valores reales — `dine_in` (Local), `takeaway` (Para llevar), `delivery` (reparto propio, nuevo), `pedidos_ya` (plataforma externa, carga manual).
- **Extras:** concepto nuevo de modificador ligado a un item específico del carrito, no un producto independiente del catálogo. **Solo para ventas normales, nunca sobre items con promoción/combo aplicado** — confirmado explícitamente, evita el caso ambiguo de a qué item queda atado un extra cuando `promotions-engine.ts` parte un combo en varias filas.
- **UI del Mesero:** sí ve precios/total del pedido (por si el cliente pregunta), aunque no cobra.
- **Notificaciones:** sonido (Web Audio) + vibración (`navigator.vibrate`, sin soporte en iOS Safari — degrada a solo sonido ahí), solo con la app abierta en foreground. Se implementa al final del roadmap, justo antes de Caja chica — decisión explícita del cliente, no por dependencia técnica.

## Plan de fases

Ver detalle completo en `roadmap-fases.md`.

| Fase | Qué entrega | Estado |
|---|---|---|
| 0 | Schema base: 4 tipos de pedido, mesa, mesero, extras por item | ✅ Hecho |
| 1 | Rol Mesero — auth | ✅ Hecho |
| 2 | Flujo Mesero UI completo | ✅ Hecho |
| 3 | Editar precio al vender (cajero/admin) | ✅ Hecho |
| 4 | Cobro diferido | ✅ Hecho |
| 5 | Ticket: mesa/mesero/notas | ✅ Hecho |
| 6 | Robustez realtime + landscape/tablet polish | ✅ Hecho |
| 7 | Identificar Pedidos Ya en cocina + toggle cajero | ✅ Hecho |
| 8 | Notificaciones sonido/vibración | ✅ Hecho |
| 9 | Caja chica (baja prioridad) | Pendiente |

## Referencias

- Notas originales de la reunión: `docs/meet/new-features.md`
- Migraciones de la Fase 0: `docs/database/migrations/multitenant/009_order_type_table_waiter_extras.sql` (dev) y `docs/database/migrations/048_order_type_table_waiter_extras.sql` (línea productiva, sin aplicar todavía)

# Pedidos online por QR

## Estado

**En progreso — Fases 0-5 hechas. Solo falta la Fase 6 (sección del admin + generador de QR).** La feature ya funciona de punta a punta: el cliente pide por el QR y el cajero confirma desde su tab. Diseño aprobado por el usuario del proyecto (2026-10-26). Funcionan: el flag `onlineOrders` y la pestaña de Configuración (Fase 0), la migración `076` aplicada y verificada en el Postgres **local** (Fase 1, todavía **no** en Supabase), los 3 endpoints públicos sin login (Fase 2), confirmar/rechazar/expirar con `order_type: 'online'` en toda la cadena incluida reportes (Fase 3), la página pública `/order/[branchId]` (Fase 4) y el tab "Pedidos online" del cajero con badge, sonido y confirmar/rechazar (Fase 5).

El **generador de QR por sucursal** también está hecho (Fase 5b), dentro del admin de Sucursales — con descarga de PNG y advertencia si la dirección no es alcanzable por un cliente.

Falta solo la Fase 6: la sección del admin con el historial de pedidos online y el total de precios.

### Pendientes transversales antes de producción

1. ~~**`trust proxy` en `main.ts`**~~ ✅ **Resuelto.** Se lee de `TRUST_PROXY_HOPS`
   (default `0`). **En el VPS de Hostinger hay que setearla en `1`** — con nginx
   adelante y la variable en 0, el rate limit del endpoint público es global en
   vez de por cliente. Si además se pone Cloudflare delante del dominio, pasa a
   `2`. Es un conteo de saltos y no un `true` a propósito: ver el comentario en
   `backend/src/common/utils/trust-proxy.ts`.
2. **Migración `076` en Supabase** — solo está en local.
3. **`manifest.json`** — un cliente que entre por el QR puede instalar el PWA del admin. Ver `roadmap-fases.md`, Fase 4.
4. **Deuda de tamaño**: `pos/page.tsx` en 206 líneas (límite 100, violación preexistente) y `PosHeader.tsx` exactamente en 200 (límite 200). Ver `roadmap-fases.md`, Fase 5.

## Objetivo

Que el cliente final de un negocio pueda **hacer su pedido solo, desde su celular, escaneando un QR** — sin instalar nada, sin registrarse y sin que nadie lo atienda.

El pedido llega al negocio como una **solicitud pendiente**. Un admin o cajero la confirma y, recién ahí, se convierte en una **venta real** del sistema (tipo `online`, **por cobrar**), que toma número de pedido, se va a comanda y descuenta stock como cualquier venta de mostrador.

## Contexto

Salió de un pedido del usuario del proyecto. Hoy toda venta nace de alguien del negocio operando el POS (cajero) o la tablet (mesero). No existe ninguna superficie por la que el cliente final interactúe con el sistema: el panel `/display` es solo lectura (espeja el carrito del cajero por `BroadcastChannel`, no acepta input).

Ya existe un controller público sin JWT — `backend/src/public-menu/`, que alimenta la landing de marketing con `GET /public/pizzas` y `GET /public/branches`. Sirve de precedente del criterio ("solo los campos seguros de exponer", comentado en su propio service) y de la mecánica (un controller sin `@UseGuards` basta, porque los guards son por controller y no globales).

Lo nuevo y sin precedente acá es el **endpoint de escritura sin autenticación**: `public-menu` solo lee. Esa es la mayor diferencia de riesgo respecto a cualquier feature anterior.

## Actores

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Superadmin** | Dueño del SaaS | Decide, por negocio, si el módulo `onlineOrders` está habilitado — vía el mecanismo `enabledModules` que ya existe. **No es autoservicio del negocio**: el admin no puede prenderlo ni apagarlo. |
| **Admin** | Dueño/encargado del negocio | Si el superadmin habilitó el módulo: configura número de WhatsApp, minutos de expiración y qué productos se muestran. Ve la sección "Pedidos online" en el sidebar con el total de precios. Confirma/rechaza pedidos. Genera el QR de cada sucursal. |
| **Cajero** | Operador del POS | Ve un tab nuevo "Pedidos online" con badge de pendientes. Confirma/rechaza. Al confirmar, la venta queda **por cobrar** y la cobra cuando el cliente llega. |
| **Cliente final** *(nuevo)* | Comensal, anónimo | Escanea el QR, ve el menú, arma un carrito, deja nombre + teléfono, confirma. Envía el WhatsApp **a mano**. Sigue el estado de su pedido desde la misma página. No se registra, no tiene login. |

## Flujo completo

**Cliente:**

1. Escanea el QR pegado en la mesa / vitrina / redes.
2. Se abre la página pública con el menú de **esa sucursal**. Sin login.
3. Arma el carrito.
4. Ingresa **nombre y teléfono**.
5. Confirma el pedido.
6. Se le abre WhatsApp con el pedido **pre-escrito** hacia el número configurado por el negocio — **él aprieta enviar**.
7. Queda en una pantalla de estado: *pendiente de confirmación*.

**Negocio:**

8. El pedido aparece al instante en el **tab del cajero** y en la **sección del admin** (notificación por WebSocket + sonido).
9. Admin o cajero revisan y **Confirman** (o **Rechazan** con motivo).
10. Al confirmar nace la venta real: `order_type: 'online'`, **sin método de pago** (queda por cobrar), número de pedido del día, comanda a cocina, descuento de stock.
11. El cliente ve en su celular que el pedido pasó a **confirmado**.
12. El cliente llega, retira y **ahí paga** — el cajero lo cobra con el flujo de cobro diferido que ya existe.

**Si nadie lo atiende:**

13. Pasados los minutos configurados, el pedido queda `expired` y no se puede confirmar más.

## Decisiones confirmadas con el usuario del proyecto

- **El pedido online NO es una venta hasta que alguien lo confirma.** Se guarda en tablas propias (`online_orders` / `online_order_items`), no en `orders`. Es la decisión que define todo el resto del diseño — ver "Por qué tabla propia" más abajo.
- **La venta confirmada nace por cobrar**, no cobrada. Se reusa el mecanismo de **cobro diferido** que ya existe para mesero (`orders.paid_by` nulo hasta que un cajero cobra vía `payOrder`). El cliente paga cuando llega a retirar.
- **El WhatsApp lo envía el cliente a mano.** El sistema arma el mensaje y abre WhatsApp en el celular del cliente; no envía nada por su cuenta y no puede saber si se envió. Por eso **la notificación real al negocio es la de la app** (tab del cajero + WebSocket), no el WhatsApp. Confirmado explícitamente con el usuario.
- **Prender/apagar el feature completo es del superadmin**, no del admin. El admin solo configura el detalle (número, minutos, visibilidad de productos).
- **La selección de productos del menú público soporta las dos maneras**: por categoría **y** producto por producto, además de "todos".
- **Un QR por sucursal**, con el `branch_id` en la URL. Los precios son por sucursal (`branch_prices`), así que el menú no se puede armar sin saber de qué sucursal se trata.
- **v1 deliberadamente simple**: el menú público ofrece **productos y variantes simples**. Sin mitad y mitad (sabores), sin extras, sin promociones. Confirmado con el usuario ("por el momento dejarlo lo más simple").

## Por qué tabla propia y no `orders`

Se evaluó escribir el pedido directo en `orders` con un estado tipo `awaiting_confirmation`. Se descartó: `orders` es la tabla de **ventas**, y todo el sistema la lee asumiendo que una fila = una venta real.

| Qué se rompería | Dónde |
|---|---|
| Aparecería en "Pedidos del día" del cajero sin estar cobrado | `OrdersService.getDayOrders` |
| Sumaría al total vendido del día | `reports.service.ts` |
| Se iría a comanda **antes** de confirmarse | `getPendingKitchenOrders` filtra por `kitchen_status: 'pending'` |
| Cada pedido basura **quemaría un número de ticket**, dejando huecos al expirar | `create_order_atomic` (advisory lock sobre `daily_number`) |
| `orders.cashier_id` es **NOT NULL con FK a `profiles`** — un cliente anónimo no tiene perfil | `orders` / `create_order_atomic` |
| Descontaría stock de pedidos nunca confirmados | misma transacción de `create_order_atomic` |

Son ~6 superficies a parchear con filtros nuevos, y cada una es un lugar donde un bug se filtra a los **números de venta del negocio**. Riesgo alto para lo que en el fondo es una bandeja de entrada.

Con tabla propia, al confirmar se llama al flujo de venta **que ya existe** (`OrdersService.create`) y todo lo demás funciona sin tocarse. La expiración pasa a ser marcar una fila de `online_orders` — **cero riesgo sobre datos de venta**.

## Lo que se reutiliza del sistema actual

| Necesidad | Qué se reusa |
|---|---|
| Recalcular precios en el servidor | `OrdersService.resolveOrderItems` — ya ignora el precio que manda el cliente y lo resuelve desde `branch_prices`/`base_price` |
| Crear la venta al confirmar | `OrdersService.create` → `create_order_atomic` (número, comanda, stock, idempotencia) |
| Venta por cobrar | `paidAtCreation` en `OrdersService.create`: si no viene método de pago, `paid_by` queda nulo |
| Avisar a comanda y al POS en vivo | `OrdersGateway.emitOrderCreated` + room por sucursal (`branch:<id>`) |
| Filtro de categorías configurable | `kitchen_visible_category_ids` en `app_settings` ya hace exactamente esto para cocina — mismo patrón |
| Flag por negocio | `BUSINESS_MODULE_KEYS` + `Business.enabledModules`; el sidebar y los tabs ya se filtran solos |
| Tab nuevo en el POS | unión `PosTab` + helper `tabBtn` en `PosHeader.tsx` |
| Sonido al llegar un pedido nuevo | `frontend/src/lib/useNewIdAlert.ts` |
| Catálogo con precios por sucursal | `ProductsService.getPosCatalog` — sirve de molde para la versión pública recortada |

## Diseño técnico

### Modelo de datos — migración `076_online_orders.sql`

**`online_orders`**

| Columna | Notas |
|---|---|
| `id` | uuid PK |
| `business_id`, `branch_id` | FK; `branch_id` es lo que viene en el QR |
| `customer_name`, `customer_phone` | texto, obligatorios |
| `total` | numeric — **calculado en el servidor**, nunca el que manda el cliente |
| `status` | `pending` / `confirmed` / `rejected` / `expired` |
| `public_token` | token aleatorio propio, es con lo que el cliente consulta su estado |
| `order_id` | FK a `orders`, **nulo hasta confirmar** — es el puente entre solicitud y venta |
| `notes` | nota opcional del cliente |
| `reject_reason` | motivo, si fue rechazado |
| `created_at`, `expires_at`, `resolved_at`, `resolved_by` | `resolved_by` FK a `profiles` (quién confirmó/rechazó) |

**`online_order_items`**: `id`, `online_order_id` FK, `variant_id` FK, `qty`, `unit_price`.

Sin tablas de sabores ni extras — es la decisión de alcance de v1.

Índices: `(branch_id, status)` para la bandeja del cajero, `(status, expires_at)` para el cron, único sobre `public_token`.

### Seguridad de la superficie pública

Es el primer endpoint de **escritura sin autenticación** del sistema (el `public-menu` que ya existe solo lee). Verificado: **no hay guard global** (`APP_GUARD`) — cada controller declara su propio `@UseGuards(JwtAuthGuard)`. Así que un controller nuevo sin ese guard ya es público, **sin tocar nada existente**. No hace falta un decorador `@Public()`.

A diferencia de `public-menu`, que resuelve el negocio con el patrón "primer negocio que exista", acá el negocio se deriva de la **sucursal que viene en la URL del QR** — multi-tenant de verdad, que es lo que esta feature necesita.

Lo que sí hay que construir:

- **Rate limiting por IP** — `@nestjs/throttler` **no está instalado**, hay que agregarlo.
- **Techos duros**: máximo de items por pedido y monto máximo, rechazados con 400.
- **Validar que la sucursal exista, esté activa y que el negocio tenga el módulo prendido.** No alcanza con esconder la UI: con el módulo apagado el endpoint debe rechazar.
- **Payload recortado a propósito** en el catálogo público: sin recetas, sin ingredientes, sin costos, sin ids internos que no haga falta exponer. No reusar el payload de `getPosCatalog` tal cual.
- **El estado se consulta por `public_token` aleatorio**, nunca por el uuid del pedido — ahí viajan nombre y teléfono de clientes reales.
- CORS: la página pública se sirve desde el mismo origen del frontend, que ya está permitido en `main.ts`. Sin cambios ahí.

### Configuración

**Superadmin** — nueva clave `onlineOrders` en `packages/shared/src/constants/business-modules.ts`:
- `BUSINESS_MODULE_KEYS` += `"onlineOrders"`
- `DEFAULT_ENABLED_MODULES.onlineOrders = false` — es una superficie pública, nadie debería tenerla prendida sin haberlo decidido
- `MODULE_LABELS` en `frontend/src/features/businesses/constants/modules.constants.ts` (cae solo en `FEATURE_MODULE_KEYS`, no es un rol)
- Recompilar `packages/shared` (`npm run build`) — frontend y backend consumen el `dist`

**Admin** — claves nuevas en `app_settings` (mismo patrón que las de cocina), pestaña nueva en Configuración oculta si el módulo está apagado:

| Clave | Qué | Default |
|---|---|---|
| `online_orders_whatsapp` | número al que el cliente manda el pedido | vacío |
| `online_orders_expire_minutes` | minutos antes de expirar | 30 |
| `online_menu_mode` | `all` / `categories` / `products` | `all` |
| `online_menu_category_ids` | ids de categorías visibles (JSON) | `[]` |
| `online_menu_product_ids` | ids de productos visibles (JSON) | `[]` |

Guardar ids en `app_settings` (texto JSON) y no una columna en `products` ni una tabla de join: es exactamente el patrón de `kitchen_visible_category_ids`, ya probado, y evita tocar el modelo de productos. Si el admin borra un producto, el id queda colgado pero es inocuo (se filtra al resolver).

### Backend

**Módulo público** (sin `JwtAuthGuard`):
- `GET /public/menu/:branchId` → catálogo recortado, respetando `online_menu_mode`; oculta productos de reventa sin stock si el negocio usa inventario
- `POST /public/orders` → registra la solicitud recalculando precios en el servidor; devuelve `public_token` y el texto para el link de WhatsApp
- `GET /public/orders/:token` → estado

**Módulo de gestión** (con `JwtAuthGuard` + `@Roles('admin','cajero')`):
- `GET /online-orders?branchId=` → pendientes; **descarta los vencidos al listar**, aunque el cron no haya corrido
- `POST /online-orders/:id/confirm` → crea la venta por el flujo existente, sin método de pago (por cobrar), `cashier_id` = quien confirma; guarda el `order_id` en la solicitud
- `POST /online-orders/:id/reject` → con motivo
- Guard de módulo (`enabled_modules.onlineOrders`) igual que `assertOfflineSalesEnabled` en `OrdersService`

**Cron de expiración** — `@nestjs/schedule` **no está instalado**, hay que agregarlo. Corre junto al filtro perezoso del listado: el filtro garantiza correctitud, el cron garantiza limpieza. Borde a cubrir: si el cajero confirma en el segundo exacto en que vence, la confirmación debe **fallar con mensaje claro**, no crear la venta.

**`order_type: 'online'`** — toca varios archivos, todo mecánico:
- `backend/src/orders/dto/create-order.dto.ts` (`@IsIn`)
- `backend/src/orders/lib/order-stock.ts` (`OrderType`, afecta `recipeApplies`)
- `frontend/src/features/pos/types/pos.types.ts`, `kitchen.types.ts`, `reports.types.ts` + 3 duplicados locales de `OrderType` (`ConfirmSaleModal.tsx`, `usePosCart.ts`, `PaymentModal.tsx`)
- `frontend/src/features/kitchen/components/OrderCard.tsx`, `pos/components/DayOrdersPanel.tsx`, `printing/constants/printing.constants.ts`
- **`reports.service.ts`**: `by_order_type` hoy devuelve **4 claves fijas**. Sumar una quinta **cambia la forma de la respuesta** → hay que actualizar `reports.types.ts`, `OrdersTable.tsx` y los tests de reportes. Es la única parte de esta lista que no es cosmética.

**Gateway**: evento nuevo al room de la sucursal cuando entra un pedido online. El cliente final **no puede** usar WebSocket (el handshake exige JWT), así que su pantalla de estado va por **polling**.

### Frontend

- **Página pública** `/order/[branchId]`, feature nueva `frontend/src/features/online-orders/`. Fuera de `(admin)`, `(pos)` y `(superadmin)` — sin guard de layout, es pública a propósito. `middleware.ts` ya deja pasar todo.
- **Cajero**: tab nuevo en `PosTab` + `PosHeader`, con badge y sonido vía `useNewIdAlert`. Oculto si el módulo está apagado (`Identity` ya trae los módulos del negocio).
- **Admin**: resource nuevo en `buildAdminResources` (`frontend/src/app/(admin)/admin-resources.tsx`), condicionado a `enabledModules.onlineOrders`, igual que `stock`/`employees`. Tabla con total de precios, confirmar/rechazar, y generación del **QR por sucursal**.

## Riesgos y bordes aceptados

- **Sobreventa posible.** El stock se descuenta al confirmar, que es cuando nace la venta. Dos clientes pueden pedir la última unidad. No es un bug: confirma un humano, el cajero rechaza el segundo. Mitigación parcial: ocultar del menú público los productos de reventa sin stock.
- **Pedidos fantasma.** El cliente puede confirmar en el sistema y nunca enviar el WhatsApp, o no aparecer nunca. Para eso está la expiración.
- **`expired` se conserva, no se borra.** "Cuántos pedidos online perdí por no atenderlos" es justo el número que un dueño quiere ver; borrando, esa señal se destruye.
- **Abuso del endpoint público.** Mitigado con rate limit + techos, no eliminado. Es el costo inherente de tener una superficie pública.
- **Colisión de nombres**: ya existe `payment_method: 'online'` (pagos procesados por app, con `payment_provider`). El nuevo `order_type: 'online'` es **otra columna**, sin conflicto técnico — mismo caso que ya pasó con `pedidos_ya` (ver `docs/features/mesero-y-mejoras-pos/roadmap-fases.md`, Fase 0).

## Fuera de alcance (v1)

- Mitad y mitad (sabores), extras y promociones en el menú público
- Envío automático del WhatsApp (requiere **WhatsApp Business API**: de pago, con plantillas aprobadas por Meta — es otro feature)
- Pago online del cliente desde la página pública
- URL con nombre corto del negocio (requeriría una columna `slug` en `businesses`, que hoy no existe)
- Delivery con dirección / cálculo de envío
- Que el cliente vea el avance en cocina (solo ve pendiente → confirmado / rechazado)

## Referencias

- `roadmap-fases.md` — detalle fase por fase, qué entrega cada una y cómo probarla
- `docs/features/mesero-y-mejoras-pos/` — cobro diferido (Fase 4) y `order_type` (Fase 0), los dos mecanismos que esta feature reusa
- `docs/features/jefe-produccion/feature.md` — precedente del patrón "módulo controlado por superadmin"

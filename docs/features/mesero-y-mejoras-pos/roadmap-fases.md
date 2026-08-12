# Roadmap de fases — Mesero, mejoras POS y notificaciones

Ver `feature.md` para objetivo, actores, alcance y decisiones. Este documento tiene el detalle técnico fase por fase. Cada fase se implementa y valida por separado — no se arranca la siguiente sin confirmar la anterior.

## Tabla resumen

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **0** | Schema base: `order_type` (4 valores), `orders.table_number`, `orders.waiter_name`, tabla de extras por item | — | ✅ Hecho |
| 1 | Rol Mesero — auth (perfil compartido por sucursal, JWT reutilizando `JwtAuthGuard`/`RolesGuard`) | Fase 0 | ✅ Hecho |
| 2 | Flujo Mesero UI — menú, mesa, extras, crear pedido, "mis pedidos", botón "Cambiar de mesero" | Fase 0, 1 | ✅ Hecho |
| 3 | Editar precio al vender (cajero/admin) | Fase 0 | ✅ Hecho |
| 4 | Cobro diferido | Fase 0 | ✅ Hecho |
| 5 | Ticket: imprimir mesa/mesero/notas | Fase 0 | ✅ Hecho |
| 6 | Robustez realtime (reconexión) + landscape/tablet polish | — (transversal) | ✅ Hecho |
| 7 | Identificar "Pedidos Ya" en cocina + toggle en cajero | Fase 0, 3 | ✅ Hecho |
| 8 | Notificaciones realtime (sonido/vibración) cocina↔cajero↔mesero | Fase 0, 1/2 | ✅ Hecho |
| 9 | Caja chica (baja prioridad, standalone) | — | Pendiente |

Orden de ejecución = orden numérico, sin saltos.

---

## Fase 0 — Order model groundwork ✅

### Qué se hizo

**Backend:**
- Migración `docs/database/migrations/multitenant/009_order_type_table_waiter_extras.sql` (aplicada en Supabase dev) + equivalente `docs/database/migrations/048_order_type_table_waiter_extras.sql` para la línea productiva (documentada, sin aplicar todavía — production no está en el track multitenant).
- `orders.order_type` amplía el CHECK a `dine_in`/`takeaway`/`delivery`/`pedidos_ya`.
- Nuevas columnas `orders.table_number`, `orders.waiter_name` (nullable).
- Nueva tabla `order_item_extras` (`id`, `order_item_id` FK, `name`, `price numeric DEFAULT 0`).
- `create_order_atomic` redefinida para insertar los campos nuevos (mismo patrón que `042`/`044`/`047`).
- `backend/prisma/schema.prisma`: `Order.tableNumber`/`waiterName`, nuevo modelo `OrderItemExtra`.
- DTOs: `create-order.dto.ts` (order_type de 4 valores + `table_number?`/`waiter_name?`), `order-item-input.dto.ts` + nuevo `order-item-extra-input.dto.ts` (`extras?`).
- `orders.service.ts`: mapea `table_number`/`waiter_name` al payload de `create_order_atomic`; los agrega también a las respuestas de `getDayOrders`/`getPendingKitchenOrders`.
- `order-stock.ts` (backend y su espejo `frontend/src/lib/order-stock.ts`, portado 1:1): `OrderType` ampliado a los 4 valores.

**Frontend:**
- `pos.types.ts`, `kitchen.types.ts`: `OrderType`/`order_type` ampliados a 4 valores + `table_number`/`waiter_name` en `DayOrder`/`KitchenOrder`.
- 3 duplicados locales de `OrderType` encontrados de paso (`ConfirmSaleModal.tsx`, `usePosCart.ts`, `PaymentModal.tsx`) — ampliados también para que compile, sin tocar su UI.
- `pos.service.ts`: `confirmSale()` acepta `tableNumber`/`waiterName` opcionales al final de la firma (nadie los pasa todavía).
- `kitchen/page.tsx`: badge de tipo de pedido extendido de 2 a 4 valores (🍽️ Local, 🥡 Para llevar, 🛵 Delivery, 📱 Pedidos Ya) + badges de mesa (🪑) y mesero (🙋) si vienen cargados.

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 70 tests de `orders` pasando.

### Hallazgos durante la implementación

- **`extras` no está integrado al cálculo de precios/promociones todavía.** El DTO acepta `order_item_input.extras`, y `create_order_atomic` los inserta si vienen, pero `orders.service.ts` no los suma al total ni los pasa por `promotions-engine.ts` (portado 1:1 del frontend, con la nota explícita de mantener ambos en sync). Integrarlo bien —decidir a qué item queda atado un extra después de que una promo COMBO puede splitear/reordenar items— se deja para la Fase 2, que es donde recién se construye la UI que crea extras reales.
- **Colisión de nombres con `payment_provider`.** Ya existía `payment_provider: 'pedidos_ya'` (`packages/shared/src/constants/payment-providers.ts`) para pagos online procesados por la app PedidosYa. El nuevo `order_type: 'pedidos_ya'` es una columna distinta, sin conflicto técnico, pero falta decidir si están relacionados antes de la Fase 7. Ver `feature.md` → "Hallazgo pendiente de decisión".

### Cómo probarla

1. **POS actual sigue igual**: una venta normal (Local o Para llevar) no debería tener ningún cambio visible ni error.
2. **Cocina con los tipos nuevos**: no hay UI todavía para crear pedidos `delivery`/`pedidos_ya` (eso es Fase 2/7). Para verlos, forzar un pedido de prueba por SQL:
   ```sql
   UPDATE orders SET order_type = 'delivery' WHERE id = '<id de un pedido pendiente>';
   ```
   y confirmar que Cocina muestra 🛵 Delivery en vez de romperse.
3. **`table_number`/`waiter_name`**: mismo pedido de prueba,
   ```sql
   UPDATE orders SET table_number = 'Mesa 5', waiter_name = 'Juan' WHERE id = '<id>';
   ```
   y confirmar que aparecen los badges 🪑 Mesa 5 y 🙋 Juan en Cocina.
4. **`order_item_extras`**: sin forma de probarlo desde la UI todavía — alcanza con que la migración haya corrido sin error. Se prueba de verdad en la Fase 2.

---

## Fase 1 — Rol Mesero (auth) ✅

### Qué se hizo

**Backend:**
- Migración `docs/database/migrations/multitenant/010_mesero_role.sql` (aplicar en Supabase dev) + equivalente `docs/database/migrations/049_mesero_role.sql` para producción (sin aplicar todavía): agrega `mesero` al CHECK de `profiles.role`.
- `create-user.dto.ts`/`update-user.dto.ts`: `mesero` agregado a la lista de roles válidos — el admin ya puede crear un perfil mesero desde el CRUD de usuarios existente, sin módulo nuevo.
- `orders.controller.ts`: `cancelOrder` no tenía ningún `@Roles(...)` (dependía de un chequeo interno laxo). Se le agregó `@Roles('admin', 'cajero', 'cocinero')` explícito para que mesero **no** pueda cancelar pedidos — el resto de los endpoints (`create`, `getDayOrders`, `getPendingKitchenOrders`) ya estaban sin restricción de rol, así que mesero puede crear y ver pedidos sin tocar nada ahí.

**Frontend:**
- `UserRole` ampliado en `lib/auth.ts` y `features/users/types/user.types.ts`.
- `features/users/constants/user.constants.ts`: `mesero` agregado a `getRoleOptions`/`getRoleLabels`/`ROLE_COLORS`; `UserModal.tsx` ahora exige sucursal también para `mesero` (igual que cajero/cocinero).
- i18n: `roles.mesero` en `es.json`/`en.json`.
- `login/page.tsx` y `authProvider.ts`: redirección `mesero → /mesero`.
- Nuevo `frontend/src/app/mesero/layout.tsx` (mismo patrón que `kitchen/layout.tsx`, permite `mesero`/`admin`) y `frontend/src/app/mesero/page.tsx`.
- Nuevo feature `frontend/src/features/mesero/` con `hooks/useMeseroName.ts` (nombre persistido en `localStorage`, no es parte del login) y `components/MeseroNameGate.tsx` (pantalla "¿Cómo te llamás?" + header con botón "Cambiar de mesero" y botón "Cerrar sesión").
- Sesión de mesero limitada a 6h: `auth.service.ts` usa `expiresIn: '6h'` en el JWT cuando `profile.role === 'mesero'` (el resto de los roles sigue con el expiry global `JWT_EXPIRES_IN`/10h). `mesero/layout.tsx` agrega un chequeo cada 60s (`getToken()`) para redirigir a `/login` apenas el token expira, sin esperar a que falle un fetch.

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 41 tests de `orders`/`users` + 8 de `auth.service` pasando.

### Bugs encontrados en validación (arreglados)

- `(pos)/layout.tsx` nunca tuvo chequeo de rol propio — dependía 100% del backend, que no restringe `create`/`getDayOrders`/`getPendingKitchenOrders` por rol. Quedó expuesto recién al agregar `mesero`: podía entrar a `/pos` por URL. Se agregó `frontend/src/features/pos/components/PosAccessGuard.tsx` (mismo patrón que `kitchen/layout.tsx`), restringido a `cajero`/`admin`, envolviendo `{children}` en `(pos)/layout.tsx`.
- Faltaba forma de cerrar sesión manual y expiración automática de la sesión de mesero — agregados ambos (ver arriba).

### Cómo probarla

1. **Crear el usuario mesero**: como admin, andá a Usuarios → Nuevo usuario → rol "Mesero", asignale una sucursal, guardá.
2. **Login**: cerrá sesión, entrá con las credenciales de ese usuario mesero. Debería redirigir a `/mesero` (no a `/pos` ni a `/login`).
3. **Pantalla de nombre**: la primera vez debería aparecer "¿Cómo te llamás?" — escribí un nombre y confirmá que después de "Empezar" aparece el header con `🙋 <nombre>` y el placeholder "Menú y creación de pedidos — próxima fase.".
4. **Persistencia**: recargá la página (F5) — el nombre debería seguir activo, sin volver a pedirlo.
5. **Cambiar de mesero**: tocá "Cambiar de mesero" — debería volver a la pantalla de "¿Cómo te llamás?".
6. **Bloqueo de rutas ajenas**: con la sesión de mesero activa, intentá entrar a `/kitchen`, `/pos` o `/dashboard` directamente por URL — debería redirigir a `/login` (mesero no tiene acceso a esas pantallas).
7. **Otros roles sin cambios**: probá que cajero/cocinero/admin siguen logueando y redirigiendo igual que antes (regresión cero).

Si todo eso funciona, la Fase 1 queda validada y seguimos con la Fase 2 (flujo completo de Mesero: menú, mesa, extras, crear pedido, "mis pedidos").

---

## Fase 2 — Flujo Mesero UI completo ✅

### Qué se hizo

**Backend** (`orders.service.ts`, `promotions-engine.ts` y su espejo `frontend/src/lib/promotions.ts`):
- Extras ahora se suman al total server-side: `price × qty` de la línea, fuera del motor de promociones.
- Nueva validación: rechaza con 400 si un item trae `extras` junto con `promo_id` o `flavors` — extras es exclusivo de ventas normales (confirmado con el cliente).
- `CartItem`/`DiscountedItem` ganaron un campo `extras?` opcional — sobrevive intacto a través de `applyPromotions` porque tanto el passthrough como el split de combos hacen `{...item}` (no se tocó la lógica de promos/combos).
- Los extras viajan hasta `create_order_atomic` (ya sabía insertarlos desde la Fase 0).

**Frontend** — nuevo dentro de `frontend/src/features/mesero/`:
- `types/mesero.types.ts`, `services/mesero.service.ts` (`createOrder`).
- `hooks/useMeseroCart.ts` (carrito propio, sin promos ni sabores mixtos), `hooks/useMeseroOrders.ts` ("mis pedidos" — reusa `PosService.getDayOrders`/`subscribeToKitchenStatus`, filtra client-side por `waiter_name === nombre local`, porque el login es compartido y no hay forma de distinguir "mío" en el backend), `hooks/useMeseroPage.ts` (orquesta todo).
- `components/MeseroCartItemRow.tsx`, `MeseroCartPanel.tsx` (mesa + carrito + extras + envío), `MeseroOrdersList.tsx` ("mis pedidos" con badge Pendiente/Listo), `MeseroPageContent.tsx` (tabs "Nuevo pedido"/"Mis pedidos").
- `mesero/page.tsx` ahora usa `MeseroPageContent` en vez del placeholder.

**Reusado sin cambios**: `usePosIdentity` (branch del mesero), `usePosProducts` (catálogo + precios), `ProductCatalog` (con `getPromoLabel` forzado a `null` — mesero no ve badges de promo), `PosService.getDayOrders`/`subscribeToKitchenStatus`/`unsubscribe`.

**order_type**: todo pedido de mesero se crea como `dine_in` fijo (no hay selector — mesero siempre es "mesa", no delivery/pedidos_ya/takeaway).

**Verificación:** `tsc --noEmit` limpio en backend y frontend, `eslint` limpio en los archivos nuevos/tocados, 329 tests backend pasando (el único que falla, `products.service.spec.ts`, es preexistente y no tiene relación).

### Cómo probarla

1. **Crear pedido**: logueado como mesero, tab "Nuevo pedido" → completá mesa → tocá un producto (se agrega al carrito) → probá +/− de cantidad → "+ Agregar extra" con nombre y precio → confirmá que el total del carrito suma bien (precio del producto + extras) × cantidad.
2. **Enviar**: tocá "Enviar pedido a cocina" — debería limpiar el carrito y pasar solo a la pestaña "Mis pedidos", mostrando el pedido recién creado con estado "Pendiente".
3. **Cocina lo recibe**: abrí `/kitchen` en otra sesión/pestaña (usuario cocinero) — el pedido debe aparecer en tiempo real con el badge 🍽️ Local, la mesa (🪑) y el nombre del mesero (🙋).
4. **Marcar listo → notificación visual**: en cocina, marcá el pedido como listo. Volvé a la tablet de mesero (tab "Mis pedidos") — el badge debe pasar a "Listo" solo, sin recargar la página (realtime).
5. **Extras en el ticket/reporte**: confirmá en Reportes (como admin/cajero) que el pedido con extras aparece con el total correcto.
6. **Extras + promo bloqueado**: esto no tiene UI para probarlo desde mesero (no hay promos ahí) — si más adelante se agregan extras a POS, hay que probar que el backend rechaza combinarlos con una promo.
7. **"Mis pedidos" no mezcla meseros**: con dos nombres de mesero distintos (usando "Cambiar de mesero") en el mismo dispositivo o dos dispositivos, confirmá que cada uno solo ve los pedidos que él mismo creó.

### Ajustes durante validación (encontrados probando en desktop y móvil)

- UI: botón "Enviar pedido a cocina" → "Realizar pedido"; montos en `$` → `Bs` (`MeseroCartPanel.tsx`, `MeseroCartItemRow.tsx`, `MeseroOrdersList.tsx`).
- UI mobile: el carrito dejó de mostrarse siempre debajo del catálogo → botón flotante 🛒 con badge (`MeseroCartFab.tsx`) que abre un drawer desde abajo (`MeseroCartDrawer.tsx`). En desktop se mantiene el panel fijo con header "Pedido".
- UI: header del mesero cambió el emoji 🙋 por un ícono de usuario + se agregó `LocaleSwitcher` (el idioma es una cookie global del sitio — si quedó en "en" de otra sesión, ahora se puede cambiar ahí mismo).
- Cocina (`kitchen/page.tsx`): los badges (tipo/mesa/mesero) se comprimían y el texto se cortaba en 2 líneas en pantallas angostas — el número de orden pasó a su propia fila y los badges de abajo ahora usan `flex-wrap` + `whitespace-nowrap`.
- **Bug real:** el panel del cajero (`DayOrdersPanel`, vía `useDayOrders`) solo escuchaba el evento realtime `order:updated` (cambios de estado), nunca `order:created` — un pedido nuevo del mesero no aparecía ahí hasta cerrar y reabrir la pestaña "Ventas del día". Se extendió `PosService.subscribeToKitchenStatus` para aceptar un callback `onInsert` opcional, y `useDayOrders` ahora refresca la lista completa al recibir `order:created`.
- **Bug real:** `crypto.randomUUID()` (usado para la idempotency key al crear pedidos) solo existe en contexto seguro (HTTPS/localhost) — probando desde el celular por HTTP/LAN tiraba `TypeError: crypto.randomUUID is not a function`. Se agregó `frontend/src/lib/uuid.ts` con fallback (`crypto.getRandomValues` → `Math.random`), usado tanto en mesero (`useMeseroPage.ts`) como en POS (`usePosPageActions.ts`, mismo problema latente ahí).

**Fase 2 validada por el usuario** tras probar creación de pedido, extras, realtime cocina↔mesero↔cajero, y el flujo desde mobile.

---

## Fase 3 — Editar precio al vender (cajero/admin) ✅

### Decisión tomada

Editar precio solo en ventas normales — igual criterio que los extras: **no** se puede editar el precio de un item con promoción (`promo_id`/`promo_label`) o pizza mixta (`flavors`), para no tener que resolver a qué línea queda atado el override si el motor de promociones parte un combo.

### Qué se hizo

**Backend:**
- Migración `docs/database/migrations/multitenant/011_order_item_price_edited.sql` (aplicar en Supabase dev) + equivalente `docs/database/migrations/050_order_item_price_edited.sql` para producción (sin aplicar todavía): `order_items.price_edited boolean DEFAULT false`, `create_order_atomic` redefinida para insertarlo.
- `backend/prisma/schema.prisma`: `OrderItem.priceEdited`.
- `order-item-input.dto.ts`: nuevo `unit_price?: number` opcional (`@Min(0)`).
- `orders.service.ts`: si el item trae `unit_price` **y** el usuario es `cajero`/`admin`, se usa ese valor en vez del resuelto de la BD y se marca `price_edited: true`. Cualquier otro rol que mande `unit_price` es ignorado (nunca se confía en el cliente salvo cajero/admin). Rechaza con 400 si el override viene junto con `promo_id`/`flavors`.
- `promotions-engine.ts` (backend) y su espejo `frontend/src/lib/promotions.ts`: `CartItem` gana `price_edited?: boolean` — sobrevive el passthrough/split igual que `extras`.
- `reports.service.ts` + `order-report-result.types.ts`: `price_edited` viaja hasta el detalle de orden en Reportes.

**Frontend (POS):**
- `usePosCart.ts`: nueva acción `updatePrice(variantId, newPrice)`.
- `CartItemRow.tsx`: el precio de un item editable (sin promo/combo/pizza mixta) es clickeable → input inline (Enter o blur confirma) → aparece tag "Editado" morado. Los items de combo/promo no muestran el lápiz de edición.
- `pos.service.ts` `confirmSale`: manda `unit_price` solo cuando el item tiene `price_edited`.
- `OrderItemsTable.tsx` (Reportes): tag "Editado" junto al precio unitario, en desktop y mobile. El ticket impreso no la incluye (no se tocó `TicketModal.tsx`).

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 70 tests de `orders` + 11 de `reports` pasando.

### Cómo probarla

1. **Editar precio**: en POS, agregá un producto sin promo al carrito → tocá el precio (Bs) → debería aparecer un input → cambiá el valor y confirmá con Enter → el precio de esa línea cambia y aparece el tag "Editado".
2. **No editable con promo/combo**: agregá un item vía la pestaña "Promociones" o que quede parte de un combo → confirmá que el precio de esa línea **no** tiene el lápiz de edición (no es clickeable).
3. **Persiste al vender**: completá la venta con un item editado — no debería tirar error de "los precios cambiaron".
4. **Reportes**: en el detalle de esa orden (Reportes → historial), el item editado debe mostrar el tag "Editado" junto al precio unitario.
5. **Ticket**: el ticket impreso/reimpreso de esa venta no debe mostrar la etiqueta "Editado" (solo el precio final).
6. **Seguridad**: si el pedido lo crea un mesero (sin este control en su UI), no debería poder mandar `unit_price` — no aplica probarlo desde la UI, es una garantía server-side.

Si todo eso funciona, la Fase 3 queda validada.

---

## Fase 4 — Cobro diferido ✅

### Decisiones tomadas

- **Sin columna `payment_status`**: se deriva de `payment_method IS NULL` (ya era el estado de las órdenes de mesero desde la Fase 2) — evita un estado redundante que se pueda desincronizar. Toda orden vieja siempre tuvo `payment_method`, así que no hay riesgo de que datos históricos aparezcan como "pendientes" por error.
- **Historial de Reportes**: muestra todas las órdenes, incluidas las pendientes de cobro, con tag "Pendiente de cobro". Solo los **totales** (ventas, top productos, por cajero) excluyen las no cobradas — no cuentan como venta hasta que se cobran.
- **Atribución en reporte por cajero**: cambia de "quién CREÓ la orden" a "quién la COBRÓ" (`paid_by`, columna nueva) — así un pedido de mesero cobrado por un cajero cuenta para ese cajero, no para el perfil compartido "mesero".

### Bug encontrado de paso

`getSales`/`getDaily` (totales del dashboard de Reportes) y `DaySummaryPanel` (resumen del día en POS) sumaban **todas** las órdenes del período sin filtrar por si tenían `payment_method` — como las órdenes de mesero ya se crean sin cobrar desde la Fase 2, ya estaban contando como "venta" plata que no había entrado. Se corrigió como parte de esta fase (era, en los hechos, el problema central que Fase 4 tenía que resolver).

### Qué se hizo

**Backend:**
- Migración `docs/database/migrations/multitenant/012_order_paid_by_cobro_diferido.sql` (aplicar en Supabase dev) + equivalente `docs/database/migrations/051_order_paid_by_cobro_diferido.sql` para producción (sin aplicar todavía): `orders.paid_by uuid REFERENCES profiles(id)`, backfill (`paid_by = cashier_id` en toda orden ya cobrada), `create_order_atomic` redefinida para insertarlo.
- `backend/prisma/schema.prisma`: `Order.paidById`/`paidBy`, relaciones nombradas (`OrderCashier`/`OrderPaidBy`) porque ahora hay dos FKs de `Order` a `Profile`.
- `orders.service.ts`: `create()` setea `paid_by = user.id` solo si la orden se crea con método de pago (POS normal); si no (mesero), queda `null`. Nuevo método `payOrder()` — valida que no esté cancelada ni ya cobrada, valida el split si es mixto, actualiza `payment_method`/`payment_provider`/`paid_by`, inserta `order_payments` si aplica, emite `order:updated` con el nuevo `payment_method`.
- Nuevo endpoint `POST /orders/:id/pay` (`@Roles('admin','cajero')`) + `PayOrderDto`.
- `reports.service.ts`: `buildWhere()` (usado por ventas/top productos/por cajero) agrega `paymentMethod: { not: null }`. `getCashiers()` agrupa por `paidById`/`paidBy` en vez de `cashierId`/`cashier`.

**Frontend:**
- `pos.service.ts`: nuevo `payOrder()`; `subscribeToKitchenStatus` ahora también propaga `payment_method` en el evento realtime.
- `useDayOrders.ts`: estado del modal de cobro (`payModal`/`paying`), `handlePayOrder`, merge de `payment_method` en el patch realtime.
- `CollectPaymentModal.tsx` (nuevo) — versión reducida de `PaymentModal` (reutiliza `OptionCard`, ahora exportado): elige efectivo/QR/mixto para una orden ya existente.
- `DayOrdersPanel.tsx`: las órdenes sin cobrar muestran un botón verde "Cobrar" en vez del ícono de método de pago (desktop y mobile).
- `DaySummaryPanel.tsx`: el total del día y los montos por método excluyen órdenes sin cobrar (mismo fix que en Reportes, aplicado también al panel de POS).
- `OrdersTable.tsx`/`OrdersMobileList.tsx` (Reportes): tag "Pendiente de cobro" en el historial cuando `payment_method` es null y la orden no está cancelada.

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 92 tests backend pasando (`orders`+`reports`+`auth`).

### Cómo probarla

1. **Aplicar la migración** `012_order_paid_by_cobro_diferido.sql` en Supabase dev antes de probar — si no, `create_order_atomic` va a fallar al insertar `paid_by`.
2. **Mesero crea pedido** → en "Ventas del día" del cajero debe aparecer con un botón verde "Cobrar" en vez del ícono de pago.
3. **Cobrar**: tocá "Cobrar" → elegí efectivo/QR/mixto → confirmá → el botón pasa a mostrar el ícono del método elegido, en tiempo real (sin recargar).
4. **No se puede cobrar dos veces**: si dos cajeros intentan cobrar el mismo pedido casi al mismo tiempo, el segundo debe recibir un error ("La orden ya fue cobrada").
5. **Resumen del día** (`DaySummaryPanel`, tab "Resumen"): el total y los montos por método NO deben incluir pedidos todavía sin cobrar; una vez cobrados, sí.
6. **Reportes → Historial**: el pedido pendiente aparece con tag "Pendiente de cobro"; una vez cobrado, muestra el método normal. El TOTAL de ventas del período solo sube cuando se cobra, no cuando se crea.
7. **Reportes → Por cajero**: el pedido cobrado debe aparecer atribuido al cajero que lo COBRÓ, no al mesero que lo creó.

Si todo eso funciona, la Fase 4 queda validada.

---

## Fase 5 — Ticket: imprimir mesa/mesero/notas ✅

### Decisión tomada

Mesa/mesero solo existen hoy en pedidos creados por el mesero, y esos no tenían ningún paso de impresión (ni al crearse, ni al cobrarse en la Fase 4). Se agregó un botón "Imprimir" (🖨️) en cada fila de "Pedidos del día" del cajero — imprime el ticket de cualquier pedido del día (mesero o POS), en cualquier momento, no solo después de cobrarlo.

### Qué se hizo

**Backend:**
- `getDayOrders` (`orders.service.ts`) y `DayOrderResult`: los `order_items` ahora incluyen `qty_physical`, `unit_price`, `discount_applied`, `promo_label` (antes solo tenían `qty` + nombre) — necesario para poder armar un ticket con precios reales desde "Pedidos del día".

**Frontend:**
- `TicketData` (`pos.types.ts`) gana `tableNumber?`, `waiterName?`, `notes?`.
- `ticket-builder.service.ts` (ESC/POS): imprime "Mesa: X" / "Mesero: Y" bajo el tipo de pedido, y "Nota: ..." antes del pie, cuando existen.
- `printing.constants.ts`: `ORDER_TYPE_LABELS` le faltaban `delivery`/`pedidos_ya` (hueco encontrado de paso — imprimían línea vacía).
- `TicketModal.tsx` (preview en pantalla): mismo contenido que el ticket impreso (mesa/mesero bajo el número de orden, nota al final).
- `usePosPageActions.ts`: `handleConfirmSale` ahora pasa `notes` al ticket de una venta normal (ya se guardaba en la orden pero no se imprimía). Nuevo `handlePrintDayOrder(order)` arma un `TicketData` a partir de un `DayOrder` y abre el mismo modal/flujo de impresión que ya existía.
- `DayOrdersPanel.tsx`: botón "Imprimir" en cada fila (desktop y mobile) + badges 🪑 mesa / 🙋 mesero junto al tipo de pedido (no existían ahí, solo en Cocina — se agregaron porque son necesarios para saber qué se está por imprimir).

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 330 tests backend pasando (1 falla preexistente en `products.service.spec.ts`, sin relación).

### Cómo probarla

1. **Venta normal con nota**: en POS, cargá una nota al confirmar el pago → el ticket (pantalla e impreso) debe mostrar "Nota: ...".
2. **Pedido de mesero**: en "Pedidos del día" del cajero, un pedido creado por el mesero debe mostrar los badges 🪑 mesa / 🙋 mesero en la fila.
3. **Imprimir desde Pedidos del día**: tocá el botón 🖨️ de cualquier pedido (cobrado o no) → se abre el ticket con mesa/mesero/notas si los tiene, y los items con su precio real.
4. **Tipos de pedido nuevos**: si hay un pedido `delivery`/`pedidos_ya`, el ticket debe imprimir la etiqueta correcta (antes salía en blanco).

Si todo eso funciona, la Fase 5 queda validada.

---

## Fase 6 — Robustez realtime + landscape/tablet polish ✅

No toca base de datos — es puro frontend.

### Qué se hizo

**Robustez realtime** (socket.io ya reintenta la conexión solo por debajo — acá se expone el estado y se resincroniza):
- `kitchen.service.ts` (`subscribeToOrders`) y `pos.service.ts` (`subscribeToKitchenStatus`): nuevo parámetro `onConnectionChange?`, escuchan `connect`/`disconnect` del socket. Al reconectar (no en la conexión inicial) disparan el mismo callback de refetch que ya se usaba para "llegó un pedido nuevo" — por si se perdió algún evento mientras estuvo desconectado.
- `useDayOrders.ts`, `useMeseroOrders.ts` (y por lo tanto `useMeseroPage.ts`), `kitchen/page.tsx`: exponen/mantienen `connected`.
- Indicador visual "🔴 Sin conexión" (parpadeante): en el header de POS (`PosHeader.tsx`, ambas variantes mobile/desktop), en el header de Cocina, y como banner en Mesero (`MeseroPageContent.tsx`, visible en ambos tabs).

**Tablet polish:**
- Mesero: el corte entre "panel de carrito fijo al costado" y "botón flotante + drawer" pasó de `md` (768px) a `lg` (1024px) — una tablet en vertical (iPad ~768-820px) quedaba con el panel partido muy angosto; ahora usa el drawer también en esos anchos, solo pasa a panel fijo en tablets/desktop bien anchos (landscape real, ≥1024px).
- Cocina: la grilla (`grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) ya escalaba bien en los anchos de tablet típicos — no se tocó.

### Cómo probarla

1. **Reconexión — Cocina**: con `/kitchen` abierto, cortá el wifi/red del dispositivo unos segundos → debe aparecer "🔴 Sin conexión" en el header. Reconectá → el badge desaparece y la lista se resincroniza sola (probá crear un pedido mientras estuvo desconectado, debería aparecer al reconectar sin recargar).
2. **Reconexión — POS**: mismo test en `/pos`, tab "Ventas del día" — badge en el header, resync al volver la conexión.
3. **Reconexión — Mesero**: mismo test en `/mesero` — banner debajo de los tabs.
4. **Tablet vertical — Mesero**: en una tablet en vertical (o achicando la ventana a ~768-900px de ancho), el carrito debe seguir siendo el botón flotante + drawer, no el panel partido apretado.
5. **Tablet horizontal — Mesero**: a partir de ~1024px de ancho, debe pasar al panel de carrito fijo al costado.

Si todo eso funciona, la Fase 6 queda validada.

---

## Fase 7 — Identificar "Pedidos Ya" en cocina + toggle en cajero ✅

No toca base de datos — `order_type` (4 valores) y `payment_provider` ya existían de fases anteriores.

### Decisión resuelta

La colisión de nombres pendiente (`payment_provider: 'pedidos_ya'` vs `order_type: 'pedidos_ya'`, ver `feature.md` → "Hallazgo pendiente de decisión") se resolvió **atándolos por construcción en la UI**: el checkbox "Es un pedido de Pedidos Ya" en `PaymentModal.tsx` (ya existía, seteaba `payment_method: online` + `payment_provider: pedidos_ya`) ahora **también** setea `order_type: pedidos_ya` — antes forzaba `takeaway`, que era exactamente el choque de conceptos. Como es la única vía para crear un pedido `pedidos_ya` desde POS, `order_type` y `payment_provider` nunca quedan desincronizados sin necesidad de validación extra en el backend.

### Qué se hizo

- `PaymentModal.tsx`: el checkbox de Pedidos Ya setea `order_type: "pedidos_ya"` (antes `"takeaway"`); se agregó "Delivery" como tercera opción manual (reparto propio, sin pasar por el checkbox).
- `ConfirmSaleModal.tsx`: el resumen antes de confirmar ya mostraba solo 2 tipos — ahora muestra los 4 con su emoji.
- `DayOrdersPanel.tsx` (Pedidos del día): el tag de tipo de pedido pasó de 2 a 4 valores (mismo hueco que tenía Cocina antes de la Fase 0).
- `DaySummaryPanel.tsx` (Resumen del día, POS): tarjetas de conteo para Delivery/Pedidos Ya (solo se muestran si hubo al menos un pedido de ese tipo).
- Reportes: `OrdersTable.tsx`/`OrdersMobileList.tsx` (historial) y `OrdersStatsRow.tsx` (tarjetas de resumen) — mismo tratamiento. Backend `getSales()` ahora calcula `by_order_type.delivery`/`.pedidos_ya` (antes esas órdenes contaban en el total pero desaparecían del desglose por tipo).
- Excel export (`useOrdersReport.ts`): la columna de tipo de pedido ya no colapsa delivery/pedidos_ya en "Comer aquí".
- i18n: `orderType.delivery`/`.pedidosYa` (+ variantes `Emoji`/`Local`/`Short`) y `plain.delivery`/`.pedidosYa` en `es.json`/`en.json`.

**Verificación:** `tsc --noEmit` limpio en backend y frontend, 330 tests backend pasando (1 falla preexistente sin relación).

### Cómo probarla

1. **Delivery manual**: en POS, al cobrar, elegí "Delivery" (nueva tercera opción) — la orden se crea con `order_type: delivery`.
2. **Pedidos Ya**: tildá el check "Es un pedido de Pedidos Ya" — debe forzar automáticamente el tipo de pedido (ya no hace falta ni se puede tocar Local/Para llevar/Delivery) y al confirmar la orden queda con `order_type: pedidos_ya` + `payment_provider: pedidos_ya`.
3. **Cocina**: el pedido de Pedidos Ya debe verse con el badge 📱 Pedidos Ya (ya funcionaba desde la Fase 0, ahora sí se puede generar desde la UI).
4. **Pedidos del día**: el mismo pedido debe mostrar el tag correcto (no "Local" por defecto).
5. **Resumen del día**: debe aparecer una tarjeta "📱 Pedidos Ya" con el conteo.
6. **Reportes**: el historial y las tarjetas de resumen deben reflejar los pedidos Delivery/Pedidos Ya correctamente, y el Excel exportado también.

### Ajuste durante validación

- Cocina (`kitchen/page.tsx`) no tenía forma de cerrar sesión — se agregó un botón "🚪 Salir" en el header, junto al selector de idioma, que llama a `signOut()` y redirige a `/login` (mismo patrón que POS/Mesero).

**Fase 7 validada por el usuario.**

---

## Fase 8 — Notificaciones sonido/vibración ✅

No toca base de datos — es puro frontend.

### Decisiones tomadas

- **Alcance del sonido "pedido listo" en cajero**: suena para **todos** los pedidos que cocina marca listos (no solo los de mesero) — cubre el caso general de "avisame cuando algo esté listo para entregar", sin importar quién lo creó.
- **Dos tonos distintos**: uno grave-agudo (dos beeps) para "pedido nuevo" en Cocina, otro agudo único para "pedido listo" en Cajero/Mesero — permite distinguir de oído qué pasó sin mirar la pantalla.
- **Sin toggle de silenciar**: siempre suena mientras la pestaña está abierta (foreground), sin configuración — consistente con la decisión original de no construir infraestructura de Web Push ni ajustes nuevos.

### Qué se hizo

**Nuevo, en `frontend/src/lib/`** (utilidad cross-cutting, no específica de una feature — mismo criterio que `useIsMobile.ts`):
- `notify.ts`: `notifyNewOrder()` / `notifyOrderReady()` (Web Audio API, sin archivos de audio — dos osciladores por tono), `vibrate()` interno con `"vibrate" in navigator` (no soporta iOS Safari, degrada a solo sonido), y `unlockAudioOnFirstInteraction()` — los navegadores bloquean Web Audio hasta el primer gesto del usuario en la página, así que se "desbloquea" el `AudioContext` apenas el operador toca la pantalla la primera vez.
- `useNewIdAlert.ts`: hook genérico — recibe una lista de ids y dispara un callback solo cuando aparece un id que no estaba antes (la primera carga nunca dispara, evita sonar por datos que ya existían al abrir la pantalla). Reutilizado igual en las 3 pantallas.

**Cocina** (`kitchen/page.tsx`): `useNewIdAlert(orders.map(o => o.id), notifyNewOrder)` sobre la lista de pedidos pendientes — como esa lista se repuebla tanto por el evento real `order:created` como por el resync al reconectar (Fase 6), un pedido que llegó mientras estaba desconectado también dispara el sonido al reconectar; si no hay pedidos nuevos, reconectar no suena.

**Cajero** (`useDayOrders.ts`): `useNewIdAlert` sobre los ids de `dayOrders` con `kitchen_status === "ready"` (sin cancelar) → `notifyOrderReady()`. Corre en segundo plano aunque el cajero esté en la pestaña "Venta" y no en "Pedidos del día" (la suscripción ya vivía fuera del tab activo desde antes).

**Mesero** (`useMeseroOrders.ts`): mismo patrón, pero filtrando primero por `myOrders` (los del mesero activo en este dispositivo) antes de mirar `kitchen_status === "ready"` — no suena por pedidos de otros meseros.

**Verificación:** `tsc --noEmit` limpio, `eslint` limpio en los archivos nuevos/tocados.

### Cómo probarla

1. **Cocina — pedido nuevo**: con `/kitchen` abierto, creá un pedido (desde POS o Mesero) → debe sonar el tono grave-agudo y vibrar (si el dispositivo soporta vibración) apenas aparece la tarjeta.
2. **Cajero — pedido listo**: con "Pedidos del día" (o cualquier tab) abierto en POS, marcá un pedido como listo desde Cocina → debe sonar el tono agudo en el cajero, sin necesidad de estar en el tab de pedidos.
3. **Mesero — pedido listo, solo el propio**: con dos meseros activos (dos nombres, mismo dispositivo o dos dispositivos), marcá listo un pedido de uno de ellos → solo debe sonar en la sesión de ese mesero, no en la del otro.
4. **Sin sonido al cargar la pantalla**: al abrir Cocina/POS/Mesero con pedidos ya pendientes o ya listos de antes, no debe sonar nada — el sonido es solo para cambios que ocurren mientras la pantalla está abierta.
5. **Reconexión (Fase 6)**: cortá la red en Cocina, creá un pedido de prueba desde otro dispositivo, reconectá — el pedido debe aparecer y sonar. Si no hubo pedidos nuevos, reconectar no debe sonar.
6. **Primer toque desbloquea el audio**: en un dispositivo que no tocaste nada todavía, el primer sonido puede no reproducirse por política del navegador (normal) — a partir de la primera vez que tocás la pantalla, los sonidos siguientes deberían sonar siempre.

### Ajuste durante validación

- Los sonidos duraban demasiado poco (un beep de ~200-380ms). Se cambió a un patrón repetido (5-6 pulsos) que dura ~3.2 segundos en total, para que se note aunque nadie esté mirando la pantalla en el momento exacto.

**Fase 8 validada por el usuario.**

---

## Fase 9 — a detallar cuando arranque

Se planea con el mismo nivel de detalle (qué se hizo, hallazgos, cómo probarla) recién cuando empiece — es baja prioridad y puede ajustarse en el camino. La tabla resumen de arriba y `feature.md` tienen el alcance a alto nivel.

# Roadmap de fases — Pedidos online por QR

Ver `feature.md` para objetivo, actores, flujo y decisiones. Este documento tiene el detalle técnico fase por fase. Cada fase se implementa y valida por separado — **no se arranca la siguiente sin confirmar la anterior**.

## Tabla resumen

| Fase | Qué entrega | Depende de | Estado |
|---|---|---|---|
| **0** | Flag `onlineOrders` (superadmin) + claves de configuración + pestaña en Configuración | — | ✅ Hecho |
| **1** | Base de datos: `online_orders` / `online_order_items` (migración 076) | — | ✅ Hecho (solo local) |
| **2** | Backend público sin login: menú, crear pedido, consultar estado + rate limiting | 0, 1 | ✅ Hecho |
| **3** | Backend de gestión: listar, confirmar (→ venta por cobrar), rechazar, expirar + `order_type: 'online'` | 1, 2 | ✅ Hecho |
| **4** | Página pública `/order/[branchId]`: menú, carrito, datos, WhatsApp, estado | 2 | ✅ Hecho |
| **5** | Cajero: tab "Pedidos online" con badge, sonido, confirmar/rechazar | 3 | ✅ Hecho |
| **5b** | QR por sucursal en el admin de Sucursales + ruta renombrada a `/order` | 4 | ✅ Hecho |
| **5c** | UX/UI del menú del cliente: grilla de tarjetas, buscador, stepper, precios | 4 | ✅ Hecho |
| **5d** | Tabs inferiores + historial en localStorage + **se eliminó el polling** | 5c | ✅ Hecho |
| **6** | Admin: sección en el sidebar con el historial y el total de precios | 3 | ✅ Hecho |

Orden de ejecución = orden numérico, sin saltos. Las fases 4/5/6 consumen el mismo backend (2 y 3), así que a partir de ahí el orden es negociable si hace falta probar algo antes.

---

## Fase 0 — Flag y configuración ✅

### Qué se hizo

**`packages/shared`:**
- `BUSINESS_MODULE_KEYS` += `"onlineOrders"`
- `DEFAULT_ENABLED_MODULES.onlineOrders = false`, con comentario de por qué el default es apagado (superficie pública)
- `npm run build` en `packages/shared` — frontend y backend consumen el `dist` compilado, sin esto no ven la clave nueva

**Superadmin:**
- `MODULE_LABELS` en `frontend/src/features/businesses/constants/modules.constants.ts` → `onlineOrders: "Pedidos online por QR (menú público)"`. Cae solo en `FEATURE_MODULE_KEYS` (no es un rol), así que aparece en el grupo correcto de `BusinessModal`/`BusinessEditModal` sin tocar esos componentes.

**Backend — `settings.service.ts`:**
- 5 claves nuevas en `SETTINGS_KEYS`: `online_orders_whatsapp`, `online_orders_expire_minutes`, `online_menu_mode`, `online_menu_category_ids`, `online_menu_product_ids`
- Defaults: whatsapp vacío, 30 minutos, modo `all`, listas vacías
- `online_menu_category_ids` / `online_menu_product_ids` se guardan como JSON en texto y se parsean igual que `kitchen_visible_category_ids` (reusar ese mismo helper)
- Agregar los campos a `SettingsResult`

**Admin — Configuración:**
- Componente nuevo `frontend/src/features/settings/components/OnlineOrdersSettingsForm.tsx`
- Pestaña nueva en `frontend/src/app/(admin)/settings/page.tsx` con `hidden: !enabledModules.onlineOrders`
- Hook nuevo `frontend/src/features/products/hooks/useProductOptions.ts` (selector por producto, mismo patrón que `useCategoryOptions`)
- Traducciones `es.json` / `en.json`

### Hallazgos durante la implementación

- **Las 5 capas tenían que ir juntas, o se rompía la configuración de otras pestañas.** El frontend manda el objeto ENTERO de configuración en cada guardado (`useSettings.handleSave` → `saveSettings(settings)`), y `updateSettings` reescribe *todas* las claves con `dto.X ?? default`. Agregar las claves solo en el backend habría hecho que guardar la pestaña de Impresora reseteara la config de pedidos online. Hay un test que lo fija (`escribe los defaults si el DTO no trae los campos de pedidos online`).
- **Por lo mismo, el regex de `online_orders_whatsapp` acepta vacío a propósito** (`/^$|^\+?[0-9]{8,15}$/`). Si no, un negocio que nunca configuró el número no podría guardar NINGUNA otra pestaña: su `""` viajaría en cada PUT y el DTO lo rechazaría con 400.
- **El checkbox del superadmin no necesitó código.** `pickValidModules` (backend) itera `BUSINESS_MODULE_KEYS` y `FEATURE_MODULE_KEYS` (frontend) se deriva del mismo array, así que la clave nueva se acepta y se renderiza sola.
- **`ONLINE_MENU_MODES` se puso en `packages/shared` desde el arranque**, no duplicado en cada lado. El union `OrderType` ya se duplicó 3 veces en el frontend por no hacer esto (ver `docs/features/mesero-y-mejoras-pos/roadmap-fases.md`, Fase 0).

### Verificación

`tsc --noEmit` limpio en backend y frontend, `next lint` limpio, 30/30 tests de `settings` (4 nuevos), 81/81 de vitest. Las 5 fallas de `orders`/`products` en Jest son pre-existentes y no tienen relación.

### Cómo probarla

1. Con el módulo **apagado** (default): la pestaña **no aparece** en Configuración.
2. Prenderlo desde el panel del superadmin para el negocio → recargar → la pestaña aparece.
3. Guardar número de WhatsApp y minutos → recargar la página → los valores persisten.
4. Elegir modo `categories` y tildar 2 categorías → guardar → recargar → siguen tildadas.
5. Ningún negocio que no tenga el módulo prendido debe ver ningún cambio en todo el sistema.

---

## Fase 1 — Base de datos (migración 076) ✅

### Qué se hizo

- `docs/database/migrations/076_online_orders.sql`, idempotente (`IF NOT EXISTS`) como las anteriores
- Tablas `online_orders` y `online_order_items` según el detalle de `feature.md` → "Modelo de datos"
- 5 índices: único sobre `public_token`, `(branch_id, status, created_at DESC)` para la bandeja, `(status, expires_at)` para el cron, parcial sobre `order_id WHERE NOT NULL`, y `(online_order_id)` en los items
- `ON DELETE CASCADE` de `online_order_items` hacia `online_orders`
- Modelos `OnlineOrder` / `OnlineOrderItem` en `backend/prisma/schema.prisma` + relaciones inversas en `Business`, `Branch`, `Profile`, `Order` y `ProductVariant` → `npx prisma generate`
- `docs/database/schema-base.sql` actualizado (tablas, PKs, índices, FKs y el CHECK nuevo de `order_type`)
- `docs/database/migrations/PENDING.md`: sección para `076` **y** para `074`/`075`, que estaban aplicadas en local pero nunca se habían documentado como pendientes de Supabase

### Decisiones tomadas acá

- **El `ALTER` de `orders_order_type_check` (sumar `'online'`) va en esta misma migración**, no en una aparte en la Fase 3. Así toda la feature es un solo script para pegar en Supabase, y permitir el valor antes de que exista código que lo produzca es inofensivo.
- **Dos CHECK de consistencia** que no estaban en el plan original: `online_orders_confirmed_has_order_check` obliga a que `confirmed` tenga venta asociada y a que ningún otro estado la tenga — barrera barata contra una confirmación aplicada a medias. Más `qty > 0` y `unit_price >= 0` en los items.
- **`online_orders.order_id` NO cascadea.** Borrar una venta no debe borrar en silencio la solicitud de la que salió, ni al revés.

### Verificación (hecha en el Postgres local)

- Aplicada, y **re-aplicada** → segunda corrida solo emite `NOTICE: already exists, skipping`, sin error
- Las 2 tablas y los 7 índices (5 nuevos + 2 PK) existen; `orders_order_type_check` ya incluye `'online'`
- Insert de una solicitud con 2 items → `ON DELETE CASCADE` deja 0 items huérfanos
- Los 5 constraints rechazan lo que deben: `confirmed` sin venta, `pending` con venta, estado inventado, `qty = 0`, token duplicado
- `INSERT` de una venta con `order_type = 'online'` ahora es aceptado
- Todo corrido dentro de transacciones con `ROLLBACK`: las tablas quedaron en 0 filas
- `prisma validate` OK, `prisma generate` OK, `tsc --noEmit` limpio, 428 tests de backend pasando

### Pendiente de esta fase

Aplicar `076` en Supabase — **no está aplicada en producción**, solo en local. Va junto con el deploy del backend de la Fase 3 (hasta entonces ningún código la usa).

---

## Fase 2 — Backend público (sin login) ✅

### Qué se hizo

**Dependencia nueva:** `@nestjs/throttler` 6.7.1.

**Módulo `backend/src/online-orders/`** — `public-online-orders.controller.ts`, **sin** `@UseGuards(JwtAuthGuard)`:

| Endpoint | Límite/IP | Qué hace |
|---|---|---|
| `GET /public/online-menu/:branchId` | 60/min | Catálogo recortado de la sucursal, respetando `online_menu_mode`. Sin recetas, ingredientes, costos ni `product_type`. Oculta reventa sin stock si el negocio usa inventario. |
| `POST /public/online-orders` | 5/min | Registra la solicitud **calculando el total en el servidor**. Devuelve `public_token`, referencia corta y el link de WhatsApp ya armado. |
| `GET /public/online-orders/:token` | 120/min | Estado (`pending`/`confirmed`/`rejected`/`expired`). Nunca por uuid. |

**Piezas puras** (`lib/`, sin Nest ni Prisma, compartidas con la Fase 3):
- `online-order.lib.ts` — totales con redondeo a 2 decimales, `expiresAtFrom`, `isActionable`/`isExpired`, armado del mensaje y del link `wa.me`
- `online-menu-filter.ts` — la regla de visibilidad del menú (`all`/`categories`/`products`)

**En `SettingsService`**, dos lecturas nuevas por `businessId` (sin `CurrentUserPayload`, porque el QR no tiene JWT): `getOnlineOrdersConfig` y `isStockTrackingEnabledForBusiness` — esta última comparte el caché de 30s que ya existía.

### Decisiones tomadas acá

- **Un solo 404 genérico** (`"Este menú no está disponible"`) para sucursal inexistente, sucursal inactiva, negocio suspendido y módulo apagado. Un endpoint público no debe dejar que un extraño sondee qué `branch_id` son reales.
- **El filtro del menú también se aplica al crear el pedido**, no solo al listarlo. Si no, cualquiera podría pedir un producto escondido mandando su `variant_id` directo y el filtro sería cosmético. Hay un test específico de esto.
- **El DTO no tiene campo `total`.** El POS sí manda uno (`OrdersService` lo compara para detectar catálogo viejo), pero acá el cliente no es staff: recibir un total sería un input más que validar sin ganar nada.
- **`ThrottlerModule` se registra en este módulo, no global.** Global empezaría a limitar el POS y la pantalla de cocina, que legítimamente hacen ráfagas (cajero apurado, socket reconectando).
- **El tipo de respuesta del menú es más angosto que el del POS a propósito** (`PublicMenuVariant` = `{id, name, price}`). Un test serializa la respuesta y verifica que no aparezcan `recipes`, `branch_prices`, `product_type` ni `basePrice`.
- **`expires_at` se congela al crear el pedido.** Si el admin después cambia los minutos, los pedidos ya abiertos conservan su plazo original — cambiarlo retroactivamente movería la expectativa que el cliente ya vio en pantalla.
- **Reutilicé el nombre `public` del controller existente** (`public-menu`, que alimenta la landing). Rutas distintas, sin colisión, y no hubo que tocar nada de lo que ya estaba.

### Hallazgos durante la implementación

- **Ya existía un controller público sin JWT** (`src/public-menu/`), que no había visto al escribir el análisis. Esto no es la primera superficie pública del sistema — es el primer **write** público. `feature.md` quedó corregido.
- **El test de wiring del módulo encontró un detalle real**: `PrismaModule` es `@Global()` y se importa una vez en `AppModule`, así que `OnlineOrdersModule` no debe importarlo (igual que `OrdersModule` y `PublicMenuModule`). El test lo provee como global aparte, y reemplaza `SettingsModule` entero porque el real arrastra `AuthModule` → `JwtStrategy`, que no se construye sin `JWT_SECRET`.

### Pendiente — `trust proxy` antes de producción ⚠️

`ThrottlerGuard` identifica al cliente por `req.ip`. `main.ts` **no** configura `trust proxy`, así que detrás de un reverse proxy (Render, Vercel, Nginx) todas las requests llegan con la IP del proxy y el límite de 5/min dejaría de ser por cliente para volverse **global**: un solo cliente activo bloquearía a todos los demás. En local no se nota.

Hay que setear `app.set('trust proxy', <n>)` en `main.ts` con la cantidad real de proxies por delante — el valor depende del hosting, y pasarse de largo permite falsificar la IP vía `X-Forwarded-For`. **Decisión pendiente del usuario.**

### Cómo probarla

Con el módulo `onlineOrders` prendido y un `branch_id` real a mano:

1. `GET /public/online-menu/:branchId` **sin ningún header de auth** → responde el menú.
2. Mismo endpoint con el módulo apagado → `404 "Este menú no está disponible"`. Con un uuid inventado → el **mismo** 404.
3. Con `online_menu_mode: categories` y 1 categoría tildada → solo vuelven productos de esa categoría. Con `products` → solo los tildados. Con `all` → todos.
4. Mirar la respuesta cruda: **no** debe traer recetas, ingredientes, costos ni `product_type`.
5. `POST /public/online-orders` con items válidos → devuelve `public_token`, `reference`, `total` y `whatsapp_url`. Abrir esa URL en el celular → WhatsApp con el pedido escrito.
6. Pedido con 31 items o `qty: 51` → 400 por el DTO.
7. Pedir el `variant_id` de un producto que el filtro esconde → 400, aunque el id sea válido.
8. Disparar 6 POST seguidos desde la misma IP en un minuto → el sexto da 429.
9. `GET /public/online-orders/:token` → `pending`. Con un token inventado → 404.
10. Poner la expiración en 5 minutos, crear un pedido, esperar → el estado pasa a `expired` solo (sin cron todavía, lo resuelve la lectura).
11. **Lo más importante**: confirmar que nada de esto apareció en "Pedidos del día" del cajero, ni en cocina, ni en reportes — todavía no es una venta.

---

## Fase 3 — Backend de gestión ✅

### Qué se hizo

**Dependencia nueva:** `@nestjs/schedule` **6.1.3** (ver "Hallazgos" — la última, 12.x, no sirve).

**Endpoints** (`JwtAuthGuard` + `RolesGuard` + `@Roles('admin','cajero')` + guard de módulo):

| Endpoint | Qué hace |
|---|---|
| `GET /online-orders?branchId=` | Pendientes de la sucursal. **Descarta los vencidos al listar**, aunque el cron no haya corrido. |
| `POST /online-orders/:id/confirm` | Crea la venta real llamando a `OrdersService.create`: `order_type: 'online'`, **sin `payment_method`** → `paid_by` queda nulo (por cobrar), `cashier_id` = quien confirma. Liga el `order_id` y pasa a `confirmed`. |
| `POST /online-orders/:id/reject` | Pasa a `rejected` con motivo obligatorio. |

**Cron** (`@Cron(EVERY_MINUTE)`): marca `expired` las `pending` vencidas y avisa por socket.

**`order_type: 'online'`** en toda la cadena — backend (`create-order.dto.ts`, `order-stock.ts`, `reports.service.ts`) y frontend (7 uniones de `OrderType`, `OrderCard`, `DayOrdersPanel`, `OrdersTable`, `OrdersMobileList`, `OrdersStatsRow`, `useOrdersReport`, `printing.constants`, traducciones ES/EN).

**Gateway**: `online-order:created` (solicitud nueva) y `online-order:resolved` (confirmada/rechazada/vencida, para que la pantalla de otro cajero la saque sola).

### Decisiones tomadas acá

- **Confirmar NO reimplementa una venta.** Llama a `OrdersService.create`, el mismo camino del POS, así que número de ticket, comanda, descuento de stock e idempotencia vienen gratis y no pueden divergir de una venta normal.
- **`idempotency_key` determinística: `online-<id del pedido>`.** Doble click, dos cajeros a la vez, o un retry tras timeout colapsan en **una sola venta** — `create_order_atomic` devuelve la existente para una key repetida. No hace falta ningún lock nuevo.
- **El `updateMany` de confirmación es condicional a `status: 'pending'`.** Si otro cajero ganó la carrera, actualiza 0 filas y no se pisa su resultado; la venta es la misma de todos modos por la key compartida.
- **Nombre y teléfono del cliente van en `orders.notes`.** `orders` no tiene columnas de cliente, y notes es lo que sí se imprime en el ticket y se ve en la comanda — que es donde el cajero los necesita. Formato `Pedido online #REF — Nombre (teléfono) — nota`, recortado a 300.
- **Un pedido vencido todavía `pending` SÍ se puede rechazar.** El negocio igual quiere decirle al cliente por qué, y un motivo le sirve más que un "venció" pelado.
- **Si `OrdersService.create` falla** (precio cambió, variante inactiva), el pedido queda **intacto en `pending`** — nada se marca, y el cajero puede rechazarlo a mano. Hay un test de esto.
- **`reports.by_order_type.online` siempre está presente**, incluso para un negocio sin el módulo (en cero), para que el frontend no tenga que ramificar.
- **Clave de traducción `plain.onlineOrder` separada de `plain.online`**: la segunda es el método de **pago** "Online", y en el Excel exportado son dos columnas distintas — reusar la misma etiqueta se lee como un error.

### Hallazgos durante la implementación

- **El riesgo de las promociones no existía.** Me preocupaba que `OrdersService.create` aplicara promos automáticamente y el total guardado dejara de coincidir. Revisando `promotions-engine.ts`: las tres promos (`BUY_X_GET_Y`, `PERCENTAGE`, `COMBO`) exigen `item.promo_id === promo.id`, y un pedido online nunca manda `promo_id`. Así que el total coincide siempre, y un desajuste significa de verdad que cambió un precio — justo el error que queremos.
- **`@nestjs/schedule` 12.x es ESM-only** (`export * from './enums/index.js'`) y el transform CommonJS de Jest no lo puede parsear: rompía 2 suites completas. Bajado a **6.1.3**, que soporta Nest 11 y es CJS. Si alguien actualiza esa dependencia sin mirar, los tests se caen con un `SyntaxError: Unexpected token 'export'` que no parece tener nada que ver.
- **El test de wiring ahora compila el grafo REAL** (`AuthModule`, `OrdersModule`, `SettingsModule`, throttler y scheduler), no stubs. Solo necesita `process.env.JWT_SECRET` seteado antes de los imports, porque `JwtStrategy` se niega a construirse sin él. Eso hace que el test valide de verdad que el módulo va a bootear.
- **`OrdersModule` ahora exporta `OrdersService`** (antes solo el gateway).
- **El backend no es lint-clean de base** (1528 errores de eslint preexistentes, casi todo prettier y `no-unsafe-*` en specs). El gate real del proyecto es `tsc --noEmit` + jest, así que me alineé con eso: corrí `--fix` sobre mis archivos y dejé solo los `no-unsafe-member-access` de los specs, que es el mismo patrón que ya usan los specs existentes.

### Verificación

`tsc --noEmit` limpio en backend y frontend, `next lint` limpio en frontend, **513 tests de backend** pasando (+28 de esta fase) y 81/81 de vitest. Las 5 fallas de `orders`/`products` siguen siendo las preexistentes.

### Cómo probarla

1. Crear una solicitud por el endpoint público → `GET /online-orders` la lista.
2. Confirmarla → verificar en BD que se creó la fila en `orders` con `order_type = 'online'`, `payment_method` nulo y **`paid_by` nulo**.
3. Esa venta debe aparecer en **comanda de cocina** y en "Pedidos del día" del cajero **como no cobrada**.
4. Cobrarla con el flujo normal de cobro diferido → `paid_by` se llena.
5. Verificar que el `daily_number` sigue la secuencia del día **sin huecos**.
6. Si el negocio usa stock → el stock se descontó recién al confirmar, no antes.
7. Reportes: la venta aparece bajo el tipo `online`, y los tipos viejos siguen con los mismos números.
8. Rechazar otra solicitud → `rejected` con motivo, sin venta creada.
9. Poner la expiración en 1 minuto, crear una solicitud, esperar → queda `expired` y confirmarla falla.
10. Doble click en Confirmar → una sola venta.

---

## Fase 4 — Página pública ✅

### Qué se hizo

- Ruta `frontend/src/app/order/[branchId]/page.tsx` (87 líneas) — **fuera** de los grupos `(admin)`/`(pos)`/`(superadmin)`, que son los que tienen guard de auth en su layout
- Feature `frontend/src/features/online-orders/` con la estructura estándar + `lib/` para la lógica pura del carrito
- Flujo: menú agrupado por categoría → barra de carrito que se expande → formulario nombre/teléfono/nota → pantalla de estado con polling cada 5s
- Botón de WhatsApp con el mensaje ya armado por el backend, y el texto **explícito** de que el cliente tiene que apretar enviar
- `public_token` en `localStorage` por sucursal: cerrar la pestaña y volver a escanear el QR recupera el pedido en vez de mostrar un menú en blanco
- Traducciones ES/EN completas (`onlineOrders.*`)

Tamaños: página 87, componente más grande 127, hook más grande 151, service 63 — todo dentro de los límites del proyecto.

### Decisiones tomadas acá

- **Tailwind y cero antd en esta ruta.** Es la única página que carga un cliente final, muchas veces con mala conexión, y Next hace code-splitting por ruta: dejar antd afuera mantiene la descarga chica. El resto del admin sigue con antd igual.
- **Polling, no WebSocket.** `OrdersGateway` exige JWT en el handshake y el cliente no tiene ninguno. El polling para solo cuando el pedido llega a un estado final, así una pantalla confirmada no sigue pegándole al backend mientras la pestaña quede abierta.
- **El polling vive en su propio hook** (`useOrderStatus`), separado de `usePublicOrderFlow`, para que un tick cada 5s no re-renderice el menú entero.
- **Se reusa `nestFetch` en vez de un `fetch` pelado.** Manda un bearer vacío que el controller sin guard ignora, y a cambio trae el timeout y el retry de GET que existen justamente para las conexiones lentas que motivaron toda la feature.
- **Dos errores de carga distintos, no uno genérico**: `MenuUnavailableError` (404 del backend: QR muerto, sucursal inactiva, módulo apagado — no hay nada que el cliente pueda hacer) vs. error de red (se ofrece "volver a intentar"). Tratarlos igual haría que el cliente reintente para siempre contra un QR muerto.
- **Los límites del DTO se replican en el front** (`MAX_QTY_PER_LINE`, `MAX_LINES_PER_ORDER`): la UI topea en vez de dejar que el cliente se coma un 400. Con el carrito lleno igual deja sumar cantidad a una línea existente — hay un test de ese borde.
- **Todo acceso a `localStorage` va en try/catch.** En modo privado tira excepción directamente, y un token guardado inservible no puede impedir que el menú se renderice.
- **El total del carrito es solo para mostrar.** El DTO no tiene campo `total` y el servidor lo recalcula; los tests fijan que el redondeo a 2 decimales coincide con el del backend.

### Pendiente — el manifest de la PWA ⚠️

`manifest.json` se linkea desde el layout raíz y tiene `start_url: "/dashboard"` con el nombre "Pizzería Admin". Un cliente que entre por el QR puede recibir el "agregar a pantalla de inicio" del navegador y terminar instalando **el PWA del admin**, que lo lleva a `/dashboard` y le pide login.

No lo toqué porque el `manifest.json` es compartido con el POS (y se acaba de ajustar por el tema de la tablet). Arreglarlo bien es un manifest aparte para la ruta pública — decisión pendiente, no bloquea probar la feature.

El service worker **no** cachea `/order` (`runtimeCaching` solo cubre `/pos` y `/display`), que es lo correcto: los precios del menú tienen que estar frescos. Sí le sirve los estáticos de Next y las imágenes de Supabase, lo cual ayuda.

### Cómo probarla

La URL es `/order/<branch_id>`. Para sacar un `branch_id`: `SELECT id, name FROM branches WHERE is_active = true;`

1. Abrir `/order/<branch_id>` desde el **celular**, sin sesión, en modo incógnito → carga el menú agrupado por categoría.
2. Tocar variantes → la barra de abajo muestra cantidad y total; expandirla y usar −/+ → el total acompaña.
3. Continuar → formulario. Mandar con nombre vacío o teléfono inválido → muestra el error y no envía.
4. Enviar con datos válidos → pantalla de estado en *pendiente* + botón de WhatsApp.
5. Tocar el botón → se abre WhatsApp con el pedido escrito y el número configurado. **Verificar que el total del mensaje coincide con el de la pantalla.**
6. Confirmar el pedido desde el cajero (o por `POST /online-orders/:id/confirm`) → en ~5s el celular pasa a *confirmado* y muestra el número de pedido.
7. Rechazar otro con motivo → el celular muestra *rechazado* **con el motivo**.
8. Dejar vencer un tercero → el celular muestra *vencido* y ofrece pedir de nuevo.
9. Cerrar el navegador y volver a escanear el QR → recupera el estado del último pedido, sin tener que rearmar nada.
10. Apagar el módulo en el superadmin y recargar → "Este menú no está disponible", no una pantalla en blanco ni un spinner infinito.
11. Poner el celular en modo avión y recargar → mensaje de error **con botón de volver a intentar**.
12. En las devtools, revisar la respuesta de `/public/online-menu/...` → **no** debe traer costos, recetas ni `product_type`.

---

## Fase 5 — Cajero ✅

### Qué se hizo

- `PosTab` += `"online"`; tab nuevo en `PosHeader.tsx` con badge de pendientes, en las dos variantes (móvil y escritorio)
- `OnlineOrdersPanel` — tarjeta por solicitud: referencia, nombre, **teléfono tappable** (`tel:`), items, nota, total y una etiqueta de cuánto le queda (roja bajo 5 min)
- Confirmar directo; rechazar abre un modal que **exige motivo** (mínimo 3 caracteres), porque ese texto es lo que el cliente ve en su pantalla
- `useOnlineOrders` — lista + socket + sonido, y **no-op total** si el módulo está apagado (ni fetch, ni socket, ni interval), mismo contrato que `useOfflineSales`
- `Identity` += `online_orders`, poblado desde `enabled_modules.onlineOrders`
- `lib/expiry.ts` — `minutesLeft`/`isExpired` puros, con tests

### Decisiones tomadas acá

- **El evento del socket dispara un refetch, no un push a la lista.** El payload de `online-order:created` solo trae lo que necesita el badge; refetchear mantiene una sola fuente de verdad para la forma de la fila (items, precios) y cuesta un request justo en el momento en que el cajero va a mirar igual.
- **`online-order:resolved` sí saca la fila sin refetch**: ya sabemos el id y el resultado, y así la pantalla del otro cajero se limpia al instante.
- **Un interval de 15s descarta localmente lo vencido**, sin esperar el evento del cron. Evita que el cajero apriete Confirmar en algo que el backend va a rechazar.
- **Si confirmar/rechazar falla, se refetchea.** La causa típica es "venció" o "otro ya lo resolvió", y en ambos casos la lista local quedó mal: dejarla como está mostraría una fila fantasma.
- **`list()` devuelve `[]` en vez de tirar excepción.** Alimenta un tab del POS que se renderiza en cada cambio de sucursal, y un fetch fallido no puede dejar al cajero mirando un spinner — es exactamente el bug que tenía el fetch de pedidos del día.
- **El tab no existe si el módulo está apagado**, no aparece deshabilitado: `onlineOrdersCount` llega en `null` y `PosHeader` no lo renderiza.

### Hallazgos durante la implementación

- **`PosHeader.tsx` quedó exactamente en 200 líneas**, el límite del proyecto. Tuve que compactar los dos condicionales del tab a una línea cada uno para no pasarme. **La próxima adición a ese archivo obliga a dividirlo.**
- **`frontend/src/app/(pos)/pos/page.tsx` quedó en 206 líneas**, contra un límite de 100 para `page.tsx`. Ya venía en 187 antes de esta fase (violación preexistente, acumulada por offline-first y el resto). Agregué 19 líneas y no lo refactoricé: bajarlo de 206 a <100 es un refactor real de props que toca todo el POS, y mezclarlo con esta fase era arriesgar la pantalla de venta. **Queda como deuda explícita.**

### Verificación

`tsc --noEmit` limpio, `next lint` limpio, **105 tests** de vitest pasando (+6 de esta fase).

### Cómo probarla

1. Módulo apagado → el tab **no existe** (no aparece deshabilitado).
2. Prendido → el tab aparece; sin pendientes muestra el vacío.
3. Con el POS abierto, mandar un pedido desde el celular por el QR → **suena y el badge sube sin recargar**.
4. Que el sonido **no** se dispare al agregar productos al carrito (regresión que ya se arregló una vez).
5. Abrir el POS con pedidos ya pendientes → **no suena** al abrir (el baseline los toma como vistos).
6. Confirmar → desaparece del tab, aparece en "Pedidos del día" **como no cobrada**, y entra a comanda con el badge 🌐.
7. Cobrarla con el flujo normal de cobro diferido → queda cobrada.
8. Rechazar sin escribir motivo → el botón está deshabilitado. Con motivo → desaparece, y el celular del cliente lo muestra.
9. Dos pestañas del POS abiertas, confirmar en una → desaparece de la otra sola (evento `resolved`).
10. Dos cajeros confirman el mismo pedido a la vez → **una sola venta**; el segundo recibe un mensaje claro y su lista se re-sincroniza.
11. Poner la expiración en 5 min, dejar el tab abierto y esperar → la fila desaparece sola (interval de 15s).
12. Tocar el teléfono del cliente en la tablet → abre el marcador.

---

## Fase 5b — QR en Sucursales + ruta en inglés ✅

Salió de dos observaciones del usuario del proyecto después de probar la Fase 5.

### Qué se hizo

**1. La ruta pública pasó de `/pedir` a `/order`.** `/pedir` violaba la convención del proyecto (código en inglés, UI en español). Se renombró la carpeta y se actualizaron los docs. No había referencias en código — la URL se arma en un solo lugar (`buildOrderUrl`).

> Nota: el repo ya tenía rutas en español preexistentes (`/mesero`, `/produccion`, `/fichar`). No se tocaron; son otra deuda, aparte de esta feature.

**2. El QR se genera desde Sucursales, no desde una sección nueva.** Es donde el admin ya está cuando piensa en una sucursal, así que no hace falta esperar la Fase 6.

- Dependencia nueva: `qrcode` + `@types/qrcode`
- `BranchQrModal` — muestra el QR, la URL con botón de copiar, y **descarga un PNG de 512px** con nombre por sucursal (`qr-central.png`)
- Botón de QR en `BranchesTable`, en las dos variantes (tabla y tarjeta móvil)
- Solo aparece si el negocio tiene el módulo **y** la sucursal está activa — un QR de una sucursal apagada no sirve, el endpoint público la rechaza
- `lib/qr.ts` (512px, corrección de errores "M" — tolera un sticker rayado sin densificar el código) y `lib/public-url.ts` (puro, con tests)

### El problema que esto destapó ⚠️

El QR codifica una URL absoluta, y hasta ahora el sistema no tenía noción de "cuál es mi dirección pública". Usar `window.location.origin` significa que un admin trabajando en `localhost:3000` genera un QR que **apunta a su propia máquina** — funciona al probarlo y es inservible para un cliente, y se descubre después de imprimir 50 stickers.

Solución: variable `NEXT_PUBLIC_PUBLIC_BASE_URL` (documentada en `.env.example`), con fallback al origin. Y `isUnreachableForCustomers` detecta localhost, loopback, `.local` y los rangos privados de RFC 1918 → el modal muestra una **advertencia explícita** antes de que el admin imprima nada.

Tiene tests, incluido el borde de que `172.32.x` **no** es privada (el rango termina en `172.31`), que una regex floja de `172.*` marcaría mal.

### Verificación

`tsc --noEmit` limpio, `next lint` limpio, **116 tests** de vitest (+11).

`BranchesTable.tsx` quedó en 199 líneas — otro archivo al borde del límite de 200.

### Cómo probarla

1. Con el módulo apagado → el botón de QR **no aparece** en Sucursales.
2. Prendido → aparece un botón de QR por cada sucursal **activa**; en una inactiva no.
3. Abrirlo → muestra el QR, y como estás en localhost/IP local, **tiene que mostrar la advertencia amarilla**.
4. Copiar el link → se copia `http://<origin>/order/<branch_id>`.
5. **Descargar PNG** → baja `qr-<sucursal>.png`, cuadrado, de 512px.
6. Escanear ese PNG desde el celular en la misma red → abre el menú de esa sucursal.
7. El QR de la otra sucursal → abre el menú con **los precios de esa otra sucursal**.
8. Setear `NEXT_PUBLIC_PUBLIC_BASE_URL=https://algo.publico` y reiniciar → la advertencia desaparece y el link usa ese dominio.

---

## Fase 5c — UX/UI del menú del cliente ✅

Pasada de diseño sobre la pantalla pública de la Fase 4. Salió de una
observación del usuario: *"del lado del cliente no se ve bien los productos"*.

### Dos bugs de layout que había

1. **La categoría se escondía detrás del header.** `PublicPageShell` tenía el
   header `sticky top-0 z-20` y `PublicMenuList` ponía los títulos de sección
   también en `sticky top-0` con `z-10`. Los dos se fijaban al mismo punto, así
   que el nombre de la categoría se deslizaba por debajo de la barra naranja y
   desaparecía.
   **Arreglo:** el header ya **no** es sticky (es branding que se lee una vez, y
   en un celular esos 56px rinden más en el menú). Ahora se fija el **buscador**,
   con `h-14` fija, y las categorías se pegan a `top-14` — un offset
   determinístico. Si no hay buscador (menú corto), se pegan a `top-0`.

2. **El último producto quedaba tapado por el carrito.** La barra es
   `fixed bottom-0` y la lista solo tenía `pb-4`.
   **Arreglo:** `pb-28` cuando hay algo en el carrito.

### Qué se hizo

- **Grilla de 2 tarjetas por fila** (`sm:grid-cols-3 lg:grid-cols-4`) en lugar de
  la lista de filas con miniatura de 64×64. Foto en `aspect-[4/3]`, que es lo que
  más vende en un menú de comida. Decisión del usuario sobre lista con foto grande.
- `components/PublicProductCard.tsx` (NEW) — tarjeta. Productos **sin foto** ahora
  tienen placeholder, y una foto que da 404 cae al placeholder vía `onError` en vez
  de mostrar el ícono de imagen rota.
- `components/QtyStepper.tsx` (NEW) — colapsado en un `+` redondo hasta que el
  producto entra al carrito, después `− qty +`. **Antes el menú solo podía sumar:**
  para bajar una cantidad había que abrir el carrito y buscar la línea. Se reusa en
  `PublicCartBar` para que los dos lugares se vean igual.
- **Variante única** (el caso común) ya no muestra la pastilla con un nombre que al
  cliente no le dice nada ("Única", "Normal") — solo precio y botón.
- `components/PublicMenuSearch.tsx` + `lib/menu-search.ts` (NEW) — buscador que
  filtra por nombre, descripción, categoría y nombre de variante, sin acentos
  (`NFD` + strip de diacríticos), así "cafe" encuentra "Café". Solo aparece con
  más de `SEARCH_MIN_PRODUCTS` (8) productos. El usuario eligió buscador y
  **descartó** los chips de categoría.
- `lib/money.ts` (NEW) — `formatMoney` / `formatLineTotal`. Antes cada componente
  hacía `{price} Bs` inline en cuatro lugares, lo que imprimía `9.9 Bs` y
  `1500 Bs`. Ahora `Bs 9.90`, **el mismo formato que el POS y el ticket impreso**:
  el cliente compara el precio del celular con lo que le cobra el cajero, así que
  los dos tienen que verse idénticos.
- El `+` se **deshabilita** al llegar al tope de líneas, con aviso. Antes
  `addToCart` rechazaba en silencio y el botón parecía roto.
- `PublicPageLoading` pasó de una línea de texto a un **skeleton** de la grilla.
- Contenido centrado en `max-w-3xl` para que el link abierto en una laptop no se
  estire de borde a borde.

### Decisión: el formato de moneda sigue la convención existente

No se usó `Intl.NumberFormat` con separador de miles (`Bs 1.500,00`) aunque sea
más prolijo: todo el resto del sistema usa `Bs {n.toFixed(2)}` y una pantalla
sola con otro formato es peor que un formato mediocre consistente.

### Hallazgo durante la implementación

El test de `normalizeText` asumía que `ñ` sobrevivía al strip de diacríticos. No:
`ñ` se descompone en `n` + tilde, así que queda `n`. Es **mejor** así (nadie busca
con la ñ del teclado del celular), pero quedó documentado en un test aparte para
que no parezca un bug más adelante.

### Verificación

- `tsc --noEmit` limpio
- `next lint` sobre `src/features/online-orders` y `src/app/order` limpio
- **129 tests** de vitest pasando (17 nuevos entre `menu-search` y `money`)
- Todos los archivos dentro de los límites: tarjeta 109, menú 91, `page.tsx` 92

### Cómo probarla

1. Escanear el QR → las fotos se ven grandes, dos por fila.
2. Un producto **sin foto** → placeholder gris, la tarjeta no se desarma.
3. Tocar `+` → se convierte en `− 1 +`. Tocar `−` hasta 0 → vuelve al `+`.
4. **Scrollear con el carrito cargado** → el último producto se alcanza, no queda
   debajo de la barra.
5. **Scrollear un menú con categorías** → el nombre de la categoría se queda
   pegado y *visible* (antes desaparecía).
6. Con 9+ productos → aparece el buscador. Con 8 o menos → no.
7. Buscar "cafe" sin acento → encuentra "Café". Buscar "grande" → encuentra el
   producto por el nombre de la variante.
8. Buscar algo inexistente → mensaje con botón "Limpiar".
9. Precios → `Bs 75.00` en menú, carrito, formulario y pantalla de estado, igual
   que en el POS.
10. Agregar 30 productos distintos → el `+` de los demás queda deshabilitado con
    aviso, en vez de no hacer nada.

---

## Fase 5d — Navegación por tabs + fin del polling ✅

Dos pedidos del usuario: una barra de tabs abajo (Productos / Carrito / Pedidos)
con el historial en localStorage, y un **botón** en lugar del texto
*"Dejá esta pantalla abierta: se actualiza sola"*.

### Corrección a la premisa del pedido ⚠️

El usuario pidió sacar el auto-refresh creyendo que era **WebSocket**. No lo era:
`useOrderStatus` hacía `setInterval` cada 5s (`STATUS_POLL_INTERVAL_MS`).

La preocupación era correcta pero el problema era **peor** de lo que suponía:

| | Antes | Ahora |
|---|---|---|
| Patrón | `GET` cada 5s por cliente esperando | on-demand |
| 1000 clientes esperando | **~200 req/s sostenidos** | ~3–5 req por pedido, en total |
| Costo cuando no cambia nada | el mismo | cero |

Un WebSocket ocioso hubiera sido **más barato** que ese polling. Pero tampoco era
opción: `OrdersGateway` exige un JWT en el handshake y el cliente no tiene
ninguno. Así que la conclusión (sacar el refresco automático) era la correcta,
por un motivo distinto al que se pensaba.

### Qué dispara el refresco ahora

1. Abrir la pantalla — una request.
2. El botón **"Actualizar estado"**, con spinner y hora del último chequeo.
3. `visibilitychange` al volver a la pestaña — **esto cubre justo la ida y vuelta
   a WhatsApp**, que es el momento en que el estado más probablemente cambió.
   Cuesta cero mientras la pestaña está en segundo plano.

Los tres se cortan en cuanto el pedido llega a un estado final (`isFinalRef`),
así que un pedido confirmado no vuelve a pegarle al backend nunca más.

Se corrigió también el copy de `statusHelp.pending`, que prometía un refresco
automático que ya no ocurre.

### Qué se hizo — tabs

- `components/PublicBottomNav.tsx` (NEW) — 3 tabs con badge. Emoji en vez de una
  librería de iconos, igual que el resto de esta ruta, que no carga antd.
- `components/PublicCartView.tsx` (NEW) — el carrito pasó de ser una hoja que
  subía desde una barra sticky a ser una **tab completa**: el nav ocupa ese
  espacio y dos barras fijas no caben en un celular. Revisar el carrito y llenar
  los datos ahora pasan en **una sola pantalla** — se eliminó el paso intermedio
  "Continuar".
- `components/PublicOrdersView.tsx` (NEW) — lista del historial y detalle.
- `components/PublicOrderTabs.tsx` (NEW) — el switch de tabs, extraído solo para
  que `page.tsx` siga bajo las 100 líneas (quedó en 59).
- `components/PublicCartBar.tsx` — **borrado**, lo reemplazan el nav y la tab.
- `CustomerForm` perdió el resumen y el botón "volver": la tab del carrito ya
  muestra las líneas editables arriba, y dos resúmenes en una pantalla era ruido.
  El botón de enviar ahora muestra el monto (`Enviar pedido · Bs 150.00`).

### Qué se hizo — historial en localStorage

- `lib/order-history.ts` (NEW) — clave `pippo_online_orders_<branchId>`, hasta 10
  pedidos, TTL de 2 días. Todo falla **soft**: `localStorage` tira excepción en
  algunos modos privados, y un cliente sin storage tiene que poder pedir igual.
- **Migración de la clave vieja**: la versión anterior guardaba un único token en
  `pippo_online_order_<branchId>`. Se lee una vez, se convierte en entrada del
  historial y se borra, así un cliente con un pedido en curso no lo pierde al
  actualizar.
- Valida la forma de cada entrada (`isStoredOrder`): el localStorage lo puede
  tocar cualquiera y un JSON roto no puede tumbar la única pantalla del cliente.
- Al abrir con pedidos guardados, arranca en la tab **Pedidos** — es lo que el
  cliente volvió a escanear el QR para ver. El menú queda a un toque.

### Decisión: el badge de "Pedidos" cuenta todo, no solo los pendientes

Saber cuáles están pendientes exigiría **una request por pedido guardado en cada
render** — exactamente el costo que esta fase vino a eliminar. El badge muestra
la cantidad de pedidos recientes, que es honesto y gratis.

### Hallazgo durante la implementación

Vitest corre este proyecto en entorno **`node`** (`vitest.config.ts`), no jsdom, y
no hay ni `jsdom` ni `happy-dom` instalados. Los tests del historial usan un
`MemoryStorage` propio con `vi.stubGlobal`, en vez de agregar una dependencia o
cambiar el entorno de toda la suite (que la haría más lenta).

### Verificación

- `tsc --noEmit` limpio
- `next lint` limpio
- **144 tests** pasando (15 nuevos de `order-history`)
- Todos los archivos en límites: `page.tsx` **59**/100, el mayor componente 157/200

### Cómo probarla

1. Abrir el QR → barra inferior con **Productos / Carrito / Pedidos**.
2. Agregar productos → el badge del carrito cuenta unidades.
3. Tab **Carrito** → líneas editables con stepper, total, y los datos del cliente
   en la misma pantalla. Vaciarlo → estado vacío con "Ver productos".
4. Enviar → salta a **Pedidos** con el pedido nuevo seleccionado.
5. En pendiente → **no hay polling**. Abrir el Network tab del navegador y
   esperar: **no tiene que haber ninguna request** hasta que toques algo.
6. Tocar **"Actualizar estado"** → una sola request, con spinner y hora.
7. Cambiar de app y volver → se refresca solo una vez (`visibilitychange`).
8. Confirmar el pedido desde el cajero y volver a la pestaña → pasa a Confirmado
   y **deja de consultar** (ni el botón ni el focus disparan más requests).
9. Cerrar la pestaña, volver a escanear el QR → arranca en **Pedidos** con el
   historial.
10. Hacer un segundo pedido → la lista muestra los dos, el más nuevo primero.
11. Con un pedido viejo en storage (más de 2 días) → no aparece en la lista.
12. Abrir un pedido que el servidor ya no tiene → "Quitar de la lista" lo borra
    del historial.

---

## Fase 6 — Admin ✅

### Qué se hizo

**Backend — endpoint nuevo `GET /online-orders/history`:**
- `dto/online-orders-history-query.dto.ts` — todos los filtros opcionales:
  `branchId`, `status`, `from`, `to`, `limit` (tope 100), `offset`
- `OnlineOrdersService.history()` — devuelve `{ items, count, total_amount }`
- `lib/online-order.lib.ts` += `ONLINE_ORDER_STATUSES`, espejo del CHECK de la 076
- `resolveBusinessId()`, el mismo guard que usan los otros services por negocio
- 9 tests nuevos

**Frontend:**
- Resource condicionado a `enabledModules.onlineOrders` en `admin-resources.tsx`
- `src/app/(admin)/online-orders/page.tsx` (47 líneas)
- `hooks/useOnlineOrdersHistory.ts` — filtros, paginación, estado de error
- `components/OnlineOrdersHistoryFilters.tsx` — sucursal, estado, rango + los dos
  números del resumen
- `components/OnlineOrdersHistoryTable.tsx` — tabla con fila expandible
- `components/OnlineOrderDetail.tsx` — items, nota del cliente, motivo del rechazo
- `lib/history-query.ts` + 8 tests
- Traducciones `onlineOrdersAdmin` y `nav.onlineOrders`

### Decisiones tomadas acá

**`history` es un método aparte, no un `list` con parámetros opcionales.**
`list()` significa SIEMPRE "pendientes y todavía confirmables" — filtra por
`status: 'pending'` y por `expiresAt > now`. Esa es una garantía de seguridad: el
cajero nunca ve una fila que no pueda confirmar. Volverla condicional a query
params habría permitido que una llamada mal armada le ponga adelante solicitudes
vencidas. El historial, en cambio, tiene que mostrar los vencidos y rechazados
justamente porque son los que el cajero nunca llegó a ver.

**El total sale de un `aggregate`, no de sumar la página.** Con dos páginas, un
total paginado miente. El `aggregate` usa el mismo `where` que la página, y hay un
test que lo fija.

**El total se rotula "Total de los pedidos listados", no "ingresos".** Con el
filtro de estado en "todos" también suma rechazados y vencidos, que nunca fueron
dinero. Para ver ingresos reales hay que filtrar por `confirmado`.

**El `where` se acota por `businessId`, no por sucursal**, así la vista por defecto
contesta "todo lo que recibió este negocio". Un `branchId` explícito igual tiene
que pertenecer al negocio, o pasar el id de una sucursal ajena filtraría sus
pedidos — hay un test de eso.

### Desvíos respecto del plan original

**La columna de venta asociada muestra el N° de ticket, no un link.** El plan decía
"que lleve al pedido real", pero **no existe** ninguna ruta de detalle de orden en
el admin: las órdenes solo se ven agregadas en `/reports`. Un link a `/reports` no
caería en esa orden, así que sería un afordance falso. El número de ticket es el
dato que cocina y el cajero usan de verdad.

**No se agregó confirmar/rechazar desde el admin.** El backend ya lo soporta (el
controller es `@Roles('admin','cajero')`), pero las acciones viven en el tab del
cajero, que es quien atiende en el momento. Agregarlas acá es una decisión de
producto pendiente, no una omisión técnica.

**La generación del QR no va acá**: se movió a Sucursales en la Fase 5b, a pedido
del usuario.

**`ONLINE_ORDER_STATUSES` quedó duplicado** entre `backend/src/online-orders/lib/`
y `frontend/src/features/online-orders/types/`. Lo correcto sería
`packages/shared`, pero ese paquete se consume como `dist` compilado y agregar un
export sin rebuildearlo rompe los dos typechecks. Son 4 literales que además fija
el CHECK de la base.

### Verificación

- `tsc --noEmit` limpio en backend y frontend
- `next lint` limpio
- **528 tests de backend** (9 nuevos) y **152 de vitest** (8 nuevos)
- Archivos en límites: `page.tsx` 47/100, mayor componente 128/200, hook 95/200

### Cómo probarla

1. Módulo apagado → la sección **no aparece** en el sidebar.
2. Prendido → aparece "Pedidos online" y lista el historial.
3. El total coincide con la suma de los pedidos listados.
4. Filtrar por `confirmado` → el total pasa a ser el ingreso real.
5. Filtrar por sucursal y por rango de fechas → resultados correctos.
6. **Un pedido vencido tiene que aparecer acá** aunque el cajero nunca lo vio.
7. Expandir una fila → items, nota del cliente, y el motivo si fue rechazado.
8. Un pedido confirmado muestra su **N° de ticket**; los demás muestran `—`.
9. Cambiar un filtro estando en la página 3 → vuelve a la página 1 (si no,
   quedaría mostrando una tabla vacía).
10. Tocar el teléfono del cliente en un celular → abre el discador.

---

## Verificación de cierre

- `tsc --noEmit` limpio en backend y frontend
- Vitest: armado del mensaje de WhatsApp, cálculo del total, lógica de expiración
- Jest: confirmar (crea venta por cobrar), rechazar, expirar, vencido no confirmable, doble confirmación, pedido de otro negocio
- `/validate-build` completo
- Actualizar `docs/database/migrations/PENDING.md` y `docs/database/schema-base.sql`
- Commits separados por fase, no uno solo al final

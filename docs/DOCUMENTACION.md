# Documentación Técnica — Pizzería Pippo
*Sistema de Gestión para Restaurante de Pizza*

**Versión:** Actual (Módulos 01–16 completados, Módulos 17–18 en desarrollo, PWA pendiente)
**Fecha:** Marzo 2026

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Base de Datos](#4-base-de-datos)
5. [Autenticación y Roles](#5-autenticación-y-roles)
6. [Módulos Implementados](#6-módulos-implementados)
7. [API Routes](#7-api-routes)
8. [Librerías y Utilidades](#8-librerías-y-utilidades)
9. [Internacionalización (i18n)](#9-internacionalización-i18n)
10. [Comunicación en Tiempo Real](#10-comunicación-en-tiempo-real)
11. [Flujos Críticos del Sistema](#11-flujos-críticos-del-sistema)
12. [Variables de Entorno](#12-variables-de-entorno)
13. [Comandos de Desarrollo](#13-comandos-de-desarrollo)
14. [Convenciones de Código](#14-convenciones-de-código)
15. [Estado Actual y Pendientes](#15-estado-actual-y-pendientes)

---

## 1. Descripción General

Sistema full-stack de gestión para restaurante de pizza con múltiples sucursales. Contempla:

- **Panel de administración** (Refine + Ant Design): gestión de productos, insumos, stock, promociones, reportes, usuarios y bodega central.
- **Punto de Venta (POS)**: pantalla para cajeros, optimizada para PC de escritorio.
- **Display cliente**: pantalla secundaria que muestra el pedido en tiempo real al cliente.
- **Kitchen Display System (KDS)**: pantalla para la cocina con los pedidos pendientes.
- **PWA**: el panel admin es instalable en celular para que el dueño revise reportes.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Framework | Next.js 14 (App Router) | Frontend + Backend en un proyecto |
| Panel Admin | Refine + Ant Design | CRUD, tablas, formularios |
| Estilos POS/Display | Tailwind CSS | UI customizada |
| Base de datos | Supabase (PostgreSQL) | Datos persistentes |
| Auth | Supabase Auth | JWT con roles |
| Storage | Supabase Storage | Imágenes de productos |
| Seguridad BD | Row Level Security (RLS) | Aislamiento por sucursal |
| Tiempo real POS | BroadcastChannel API | POS ↔ Display (sin internet) |
| i18n | next-intl | Español (default) e inglés |
| PWA | next-pwa | App instalable para admin |
| Data fetching | SWR | Cache y revalidación |
| Gráficos | Recharts | Reportes |
| Exportación | xlsx | Exportar reportes a Excel |
| Testing E2E | Playwright | Tests de integración |

---

## 3. Arquitectura del Proyecto

### 3.1 Estructura de Directorios

```
pizzeria-pippo/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API Routes (backend)
│   │   ├── (admin)/                # Rutas del panel admin (protegidas por Refine)
│   │   ├── (pos)/                  # Ruta del POS
│   │   ├── display/                # Pantalla cliente
│   │   ├── kitchen/                # Pantalla cocina
│   │   └── login/                  # Login
│   │
│   ├── features/                   # Arquitectura feature-based
│   │   ├── branches/
│   │   ├── ingredients/
│   │   ├── products/
│   │   ├── variant-types/
│   │   ├── stock/
│   │   ├── promotions/
│   │   ├── pos/
│   │   ├── display/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── dashboard/
│   │   └── warehouse/
│   │
│   ├── lib/                        # Utilidades y lógica de negocio compartida
│   └── i18n/                       # Configuración de internacionalización
│
├── docs/
│   ├── database/                   # Schema y migraciones SQL
│   ├── features/                   # Documentación por módulo
│   ├── tests/                      # Planes de prueba (manual + automatizados)
│   ├── improves/                   # Planes de refactor y mejoras
│   └── architecture/               # Arquitectura de código
│
├── messages/                       # Traducciones i18n (es.json, en.json)
├── public/                         # Assets estáticos, íconos PWA
├── supabase/                       # Schema inicial (001_schema.sql)
└── tests/                          # Playwright E2E tests
```

### 3.2 Arquitectura Feature-Based

Cada feature sigue esta estructura obligatoria. **Nunca agregar lógica directamente en `page.tsx`.**

```
src/features/<nombre>/
├── components/     # UI pura — recibe props, sin queries directas
├── hooks/          # Estado y lógica de negocio — llama a services
├── services/       # Comunicación con Supabase/API — sin estado
├── types/          # Interfaces TypeScript
└── constants/      # Configuración estática (opciones de select, colores)
```

**Límites de tamaño obligatorios:**

| Archivo | Máximo |
|---------|--------|
| `page.tsx` | 100 líneas |
| `components/` | 200 líneas |
| `hooks/` | 200 líneas |
| `services/` | 150 líneas |

Si un archivo supera **300 líneas**, debe dividirse antes de continuar.

### 3.3 Rutas de la Aplicación

| Ruta | Acceso | Descripción |
|------|--------|-------------|
| `/login` | Público | Formulario email/contraseña |
| `/dashboard` | Admin | Dashboard con métricas y alertas |
| `/(admin)/branches` | Admin | Gestión de sucursales |
| `/(admin)/products` | Admin | Catálogo con wizard 3 pasos |
| `/(admin)/ingredients` | Admin | Gestión de insumos |
| `/(admin)/stock` | Admin | Inventario (4 tabs) |
| `/(admin)/promotions` | Admin | Motor de promociones |
| `/(admin)/reports` | Admin | Reportes y analítica |
| `/(admin)/users` | Admin | Gestión de usuarios |
| `/(admin)/variant-types` | Admin | Definición de tamaños de variantes |
| `/(admin)/warehouse` | Admin | Bodega central |
| `/(admin)/warehouse/purchase` | Admin | Registrar compra a bodega |
| `/(admin)/warehouse/transfer` | Admin | Transferencia bodega → sucursal |
| `/(admin)/warehouse/movements` | Admin | Historial de movimientos bodega |
| `/pos` | Cajero | Punto de venta |
| `/display` | Público | Pantalla secundaria cliente |
| `/kitchen` | Cocinero | Pantalla de cocina (KDS) |

---

## 4. Base de Datos

### 4.1 Tablas Principales

```sql
branches              — sucursales (id, name, address, is_active)
profiles              — extiende auth.users (role, branch_id, full_name, is_active)

products              — catálogo (id, name, category, description, image_url, is_active)
product_variants      — variantes (id, product_id, name, base_price)
branch_prices         — precio override por sucursal+variante (branch_id, variant_id, price)
variant_types         — definición de tamaños del sistema (id, name, sort_order)

ingredients           — insumos (id, name, unit: g|kg|ml|l|unidad)
branch_stock          — stock por sucursal (branch_id, ingredient_id, quantity, min_quantity)
recipes               — receta interna por variante (variant_id, ingredient_id, quantity, apply_condition)
stock_movements       — auditoría (branch_id, ingredient_id, quantity, type, origin)

warehouse_stock       — bodega central (ingredient_id, quantity, min_quantity)
warehouse_movements   — auditoría bodega (ingredient_id, quantity, type, to_branch_id)

promotions            — promociones (id, name, type, days_of_week, start_date, end_date, branch_id, active)
promotion_rules       — reglas (promotion_id, variant_id, buy_qty, get_qty, discount_percent, combo_price)

orders                — ventas (id, branch_id, cashier_id, total, daily_number, payment_method, order_type, kitchen_status, cancelled_at, cancelled_by, cancel_reason)
order_items           — detalle (order_id, variant_id, qty, qty_physical, unit_price, discount_applied, promo_label)
order_item_flavors    — sabores de pizza mitad/mitad (order_item_id, variant_id, proportion)
```

### 4.2 Tipos y Enums Relevantes

| Campo | Valores posibles |
|-------|-----------------|
| `profiles.role` | `admin`, `cajero`, `cocinero` |
| `products.category` | `pizza`, `bebida`, `otro` |
| `ingredients.unit` | `g`, `kg`, `ml`, `l`, `unidad` |
| `recipes.apply_condition` | `always`, `takeaway`, `dine_in` |
| `promotions.type` | `BUY_X_GET_Y`, `PERCENTAGE`, `COMBO` |
| `orders.payment_method` | `efectivo`, `qr` |
| `orders.order_type` | `dine_in`, `takeaway` |
| `orders.kitchen_status` | `pending`, `ready` |
| `stock_movements.type` | `compra`, `venta`, `ajuste`, `anulacion` |
| `warehouse_movements.type` | `compra`, `transferencia`, `ajuste` |

### 4.3 Concepto Clave: qty vs qty_physical

Las `order_items` tienen **dos cantidades**:

- **`qty`** = unidades que el cliente **paga** (la que se factura)
- **`qty_physical`** = unidades que **salen de cocina** (incluye gratuitas de promos BUY_X_GET_Y)

Ejemplo: promo "compra 2, llévate 3" → `qty = 2`, `qty_physical = 3`

El descuento de stock y la preparación en cocina usan `qty_physical`.

### 4.4 Migraciones Aplicadas

| Archivo | Descripción |
|---------|-------------|
| `001_schema.sql` | Schema inicial — NUNCA modificar |
| `002_soft_delete.sql` | Columna `is_active` para borrado suave |
| `003_order_items_qty_physical.sql` | `qty_physical` en order_items |
| `004_orders_kitchen_status.sql` | `kitchen_status` en orders |
| `005_profiles_cocinero_role.sql` | Rol `cocinero` + RLS para cocina |
| `006_add_daily_number_to_orders.sql` | Número de orden diario por sucursal |
| `007_add_warehouse.sql` | Tablas `warehouse_stock` y `warehouse_movements` |
| `008_warehouse_rls.sql` | RLS para bodega (solo admin) |
| `009_add_payment_method_to_orders.sql` | `payment_method` (efectivo/qr) |
| `010_add_promo_label_to_order_items.sql` | `promo_label` en order_items |
| `011_order_type_and_recipe_condition.sql` | `order_type` en orders + `apply_condition` en recipes |
| `012_variant_types.sql` | Tabla `variant_types` |
| `013_pizza_flavors.sql` | Tabla `order_item_flavors` para pizzas mitad/mitad |
| `014_combo_flexible_rules.sql` | Columnas `category` y `variant_size` en `promotion_rules` para combos flexibles |
| `015_order_cancellation.sql` | Columnas `cancelled_at`, `cancelled_by`, `cancel_reason` en `orders` |
| `016_allow_negative_branch_stock.sql` | Permite stock negativo en `branch_stock` (mín. -99999) |
| `017_stock_movements_add_anulacion_type.sql` | Agrega tipo `anulacion` al check de `stock_movements.type` |
| `018_fix_variant_size_check.sql` | Elimina check de `variant_size` en `promotion_rules` para aceptar cualquier tamaño |

### 4.5 Reglas de Migraciones

1. Crear el archivo SQL en `docs/database/migrations/NNN_descripcion.sql` **antes** de aplicar en Supabase.
2. Aplicar manualmente en el SQL Editor de Supabase.
3. Actualizar `docs/database/schema-base.sql` **después** de aplicar.
4. Nunca modificar `supabase/001_schema.sql`.

### 4.6 Convenciones RLS Importantes

- Las políticas `FOR ALL` con solo `USING` **NO cubren INSERT** — siempre separar en políticas individuales.
- Políticas INSERT usan `WITH CHECK`, UPDATE/DELETE usan `USING`.
- Los cajeros solo ven datos de su `branch_id` asignado en `profiles`.
- La bodega (`warehouse_*`) es solo accesible por `admin`.

---

## 5. Autenticación y Roles

### 5.1 Estrategia

- Supabase Auth con email/contraseña.
- JWT pasado en header `Authorization: Bearer <token>` en todas las API routes.
- Service role key del lado del servidor únicamente (gestión de usuarios).

### 5.2 Roles y Acceso

| Rol | Pantallas | Sucursal |
|-----|-----------|---------|
| `admin` | Todo el sistema | Ambas sucursales |
| `cajero` | Solo `/pos` | Su sucursal asignada (automática) |
| `cocinero` | Solo `/kitchen` | Su sucursal asignada |

### 5.3 Flujo de Login

1. Usuario ingresa email/contraseña en `/login`.
2. Supabase Auth retorna token JWT.
3. Se consulta `profiles` para obtener `role` y `branch_id`.
4. Redirección automática:
   - `admin` → `/dashboard`
   - `cajero` → `/pos`
   - `cocinero` → `/kitchen`

### 5.4 Identidad en el Sistema

```typescript
// getIdentity() retorna:
{
  id: string,
  name: string,
  role: "admin" | "cajero" | "cocinero",
  branch_id: string | null,
  avatar: string | null
}
```

---

## 6. Módulos Implementados

### Módulo 01 — Sucursales

**Ruta:** `/(admin)/branches`
**Feature:** `src/features/branches/`

Gestión de las sucursales del restaurante. Permite crear, editar, activar/desactivar sucursales. No se puede desactivar una sucursal que tiene cajeros asignados (muestra modal con lista de cajeros afectados).

**Componentes:** `BranchesTable`, `BranchModal`, `BranchBlockedModal`

---

### Módulo 02 — Insumos

**Ruta:** `/(admin)/ingredients`
**Feature:** `src/features/ingredients/`

Registro de los insumos del restaurante con su unidad de medida. Son la base para definir las recetas de cada producto.

**Componentes:** `IngredientsTable`, `IngredientModal`
**Unidades:** `g` (gramos), `kg` (kilos), `ml` (mililitros), `l` (litros), `unidad`

---

### Módulo 03 — Productos

**Ruta:** `/(admin)/products`
**Feature:** `src/features/products/`

Registro de productos con wizard de 3 pasos:

**Paso 1 — Datos generales:**
- Nombre, categoría (pizza/bebida/otro)
- Descripción para el cliente (ingredientes visibles)
- Imagen (subida a Supabase Storage, bucket `product-images`)

**Paso 2 — Variantes y precios:**
- Agrega tamaños disponibles (Personal, Mediana, Familiar)
- Precio base por variante
- Precio override por sucursal (si Sucursal B tiene precio diferente)

**Paso 3 — Receta por variante:**
- Para cada variante: qué insumos usa y en qué cantidad
- `apply_condition`: si el descuento de stock aplica siempre, solo takeaway o solo dine_in
- Esta receta es **interna** — el cliente nunca la ve

**Componentes:** `ProductModal` (wizard), `ProductsTable`, `ProductStepGeneral`, `ProductStepVariants`, `ProductStepRecipes`, `CategoryIcon`, `ProductImage`

---

### Módulo 04 — Tipos de Variantes

**Ruta:** `/(admin)/variant-types`
**Feature:** `src/features/variant-types/`

Define los tamaños disponibles a nivel de sistema (Personal, Mediana, Familiar, etc.) con orden de display. Estos tipos son los disponibles para seleccionar al crear variantes de producto.

---

### Módulo 05 — Inventario / Stock

**Ruta:** `/(admin)/stock`
**Feature:** `src/features/stock/`

Cuatro tabs:

| Tab | Descripción |
|-----|-------------|
| **Stock Actual** | Tabla de inventario por insumo en la sucursal seleccionada. Muestra cantidad actual vs mínimo. Alertas en rojo si hay stock bajo |
| **Compra** | Registra entrada de insumos (compra). Suma al stock de sucursal. Crea movimiento tipo `compra` |
| **Ajuste** | Ajuste manual por conteo físico. Inserta la diferencia. Crea movimiento tipo `ajuste` |
| **Historial** | Todos los movimientos (compra/venta/ajuste) filtrados por sucursal y fecha |

El stock también se descuenta automáticamente al confirmar una venta desde el POS (tipo `venta`).

---

### Módulo 06 — Promociones

**Ruta:** `/(admin)/promotions`
**Feature:** `src/features/promotions/`

Motor de promociones con tres tipos:

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| `BUY_X_GET_Y` | Compra X, llévate Y gratis | 2x1, compra 4 llévate 5 |
| `PERCENTAGE` | Descuento porcentual | 20% de descuento en pizzas |
| `COMBO` | Precio especial por combinación | Pizza + bebida = Bs 35 |

Cada promoción tiene:
- Días de la semana en que aplica (lunes = 1 ... domingo = 0)
- Rango de fechas de vigencia
- Sucursal a la que aplica
- Reglas por variante (buy_qty, get_qty, discount_percent, combo_price)

**Combos flexibles:** las reglas de COMBO pueden apuntar a una variante específica (`variant_id`) o a un slot genérico (`category` + `variant_size`). Por ejemplo: "cualquier pizza Personal" en lugar de una variante exacta. Si ambos campos son NULL, el comportamiento es el original (match por `variant_id`). El campo `variant_size` acepta cualquier string libre (no está limitado a Personal/Mediana/Familiar).

**Componentes:** `PromotionsTable`, `PromotionModal`, `PromotionRules`

---

### Módulo 07 — POS (Punto de Venta)

**Ruta:** `/pos`
**Feature:** `src/features/pos/`

Pantalla optimizada para PC de escritorio. El cajero no necesita seleccionar sucursal — se detecta automáticamente desde `profiles.branch_id`.

**Flujo del POS:**
1. Al iniciar, carga las promociones vigentes del día y de la sucursal del cajero.
2. Muestra el catálogo de productos filtrado por sucursal.
3. Los productos con promo activa aparecen destacados (badge, etiqueta "2x1", etc.).
4. Al agregar un producto, se abre el `VariantSelectorModal` para elegir tamaño.
5. Las promociones se aplican automáticamente al carrito.
6. El cajero puede seleccionar tipo de orden (dine_in / takeaway) y método de pago (efectivo / qr).
7. Al confirmar, se crea la orden vía `POST /api/orders`.
8. El sistema asigna número de orden diario (secuencial por sucursal y día).
9. Se muestra el `TicketModal` con resumen de la venta.

**Tabs del POS:** la pantalla está dividida en tres pestañas:

| Tab | Descripción |
|-----|-------------|
| **Venta** | Catálogo de productos + carrito activo |
| **Pedidos del día** | Lista de órdenes del día con estado de cocina y botón de anulación |
| **Resumen** | Totales del día: ventas, cantidad de órdenes, ticket promedio |

**Pizzas mitad/mitad:** el `VariantSelectorModal` permite elegir dos sabores para una pizza. Cada sabor se guarda en `order_item_flavors` con `proportion = 0.50`.

**Anulación de órdenes:** desde la tab "Pedidos del día" el cajero (o admin) puede anular una orden. Se registran `cancelled_at`, `cancelled_by` y `cancel_reason` en `orders`. El stock se restaura automáticamente via `reverseStock()`. Las órdenes anuladas se muestran con tag rojo "Anulada" y se excluyen de reportes, cocina y badge del POS.

**Selector de sucursal para admin:** el admin puede usar el POS en cualquier sucursal — ve un selector al inicio.

**Componentes:** `PosHeader`, `ProductCatalog`, `PosCart`, `VariantSelectorModal`, `PaymentModal`, `ConfirmSaleModal`, `TicketModal`, `DayOrdersPanel`, `DaySummaryPanel`, `CancelOrderModal`, `BranchSelector`

---

### Módulo 08 — Display Cliente

**Ruta:** `/display`
**Feature:** `src/features/display/`

Pantalla secundaria que se arrastra al monitor del cliente. Se comunica con el POS mediante **BroadcastChannel API** (canal: `"pos-display"`) — sin internet, sin Supabase Realtime.

**Tres modos:**

| Modo | Cuándo se muestra | Contenido |
|------|------------------|-----------|
| `menu` | Sin pedido activo | Catálogo con fotos e ingredientes del cliente |
| `order` | Cajero armando pedido | Productos del carrito + total en tiempo real |
| `thanks` | Orden confirmada | Pantalla de agradecimiento + número de orden |

La paginación del menú permite navegar cuando hay muchos productos.

**Componentes:** `DisplayMenu`, `DisplayCart`, `DisplayThankYou`

---

### Módulo 09 — Reportes

**Ruta:** `/(admin)/reports`
**Feature:** `src/features/reports/`

Reportes filtrables por sucursal y rango de fechas.

| Sección | Descripción |
|---------|-------------|
| **Resumen** | Cards: total vendido, cantidad de órdenes, ticket promedio |
| **Ventas diarias** | Gráfico de líneas (Recharts) con ventas por día |
| **Top productos** | Gráfico de torta + tabla con los más vendidos |
| **Órdenes** | Tabla con todas las órdenes del período, expandible para ver ítems |
| **Por cajero** | Ventas agrupadas por cajero |
| **Alertas de stock** | Insumos bajo mínimo en la sucursal seleccionada |
| **Exportar** | Botón para descargar Excel con las órdenes del período |

---

### Módulo 10 — Usuarios

**Ruta:** `/(admin)/users`
**Feature:** `src/features/users/`

Gestión de usuarios del sistema (cajeros, cocineros y admins). Las API routes de usuarios usan la **service role key** para gestionar usuarios de Supabase Auth.

- Crear usuario: crea en Auth + inserta en `profiles`
- Editar: actualiza `profiles` (nombre, rol, sucursal)
- Desactivar: soft-delete (is_active = false), no borra de Auth
- Los clientes del restaurante **no tienen cuenta** en el sistema

**Roles disponibles:** `admin`, `cajero`, `cocinero`

---

### Módulo 11 — Dashboard

**Ruta:** `/dashboard`
**Feature:** `src/features/dashboard/`

Panel principal del admin al iniciar sesión. Combina datos de múltiples fuentes:

- Cards de resumen: ventas del día, órdenes del día, ticket promedio
- Gráfico de ventas diarias (últimos 7 días)
- Gráfico de top productos (últimos 7 días)
- **Alertas de bodega** (naranja): stock bajo en `warehouse_stock`
- **Alertas de sucursal** (rojo): stock bajo en `branch_stock` de cualquier sucursal

---

### Módulo 12 — Kitchen Display System (KDS)

**Ruta:** `/kitchen`

Pantalla para los cocineros. Muestra las órdenes pendientes en tarjetas.

- Muestra tiempo transcurrido desde la creación
- Órdenes con más de **10 minutos** se marcan en rojo como alerta
- El cocinero puede marcar una orden como "lista" → `kitchen_status = 'ready'`
- Se actualiza automáticamente con SWR (polling)
- Acceso exclusivo para rol `cocinero`

---

### Módulo 13 — Bodega Central

**Rutas:** `/(admin)/warehouse` y subrutas
**Lib:** `src/lib/warehouse.ts`

Stock central separado del stock por sucursal. Permite:

| Operación | Descripción |
|-----------|-------------|
| **Compra** | Ingresan insumos a la bodega (aumenta `warehouse_stock`) |
| **Transferencia** | Mueve insumos de bodega a una sucursal (resta de `warehouse_stock`, suma en `branch_stock`) |
| **Ajuste** | Corrección por conteo físico en bodega |
| **Historial** | Todos los movimientos de bodega filtrados por tipo/insumo/fecha |

**Columna `origin`** en `stock_movements`: cuando el stock de una sucursal viene de una transferencia de bodega, el movimiento se registra con `origin = 'warehouse'`.

---

### Módulo 14 — Tipo de Orden y Condición de Receta

Los pedidos pueden ser:
- **`dine_in`**: para consumir en el local
- **`takeaway`**: para llevar

El campo `apply_condition` en `recipes` permite configurar si la receta aplica:
- `always`: siempre se descuenta stock (default)
- `dine_in`: solo si el pedido es para consumir en local
- `takeaway`: solo si es para llevar

Esto permite, por ejemplo, no descontar el vaso desechable si el cliente come en el local.

---

### Módulo 15 — Tipos de Variantes

Los tamaños de variantes (Personal, Mediana, Familiar) se definen a nivel sistema en la tabla `variant_types`. El admin puede crear nuevos tipos si el restaurante agrega nuevos tamaños. Al crear un producto, las variantes disponibles se toman de esta tabla.

---

### Módulo 17 — Notificaciones Telegram (Alertas de Stock)

> ⚠️ **En desarrollo — branch `main` (no aplicado en producción)**

**Lib:** `src/lib/notifications.ts`
**Migración pendiente de aplicar:** `docs/database/migrations/019_app_settings.sql`

Envía alertas automáticas a un chat o grupo de Telegram cuando el stock de un insumo cae por debajo del mínimo configurado. Se dispara como efecto secundario de una venta (fire-and-forget — no bloquea el POS).

**Tabla nueva:** `app_settings` — clave/valor para configuraciones globales. Claves: `telegram_bot_token`, `telegram_chat_id`, `telegram_enabled`.

**API Routes:**
- `GET/PUT /api/settings` — lee y guarda la configuración (token enmascarado en GET)
- `POST /api/settings/test` — envía mensaje de prueba con el token del formulario (sin guardar)

**UI:** `/(admin)/settings` → tab "Notificaciones". Formulario con Bot Token, Chat ID y toggle. Flujo recomendado: ingresar datos → Probar conexión → Guardar.

**Integración:** al final de `deductStock()` en `src/lib/recipes.ts`, se comparan los valores de `branch_stock` con `min_quantity`. Si hay insumos bajo mínimo, se llama `sendTelegramAlert()` sin `await`.

**Nota sobre Chat ID:** puede ser de un grupo de Telegram (ID negativo, ej: `-1001234567890`). Recomendado para que múltiples admins reciban la alerta en un grupo compartido.

---

### Módulo 18 — Bot de IA en Telegram

> ⚠️ **En desarrollo — branch `main` (no aplicado en producción)**

**Lib:** `src/lib/telegram-ai.ts`
**Migraciones pendientes de aplicar:** `docs/database/migrations/020_telegram_ai_bot.sql`

Bot de Telegram con IA que permite consultar el sistema en lenguaje natural (ventas, stock, reportes, promociones). Usa el webhook de Telegram y responde en el mismo chat.

**Tablas nuevas:**
- `telegram_authorized_chats` — chats/grupos con acceso al bot (plan: basic/pro/unlimited)
- `telegram_usage` — consumo diario por chat para control de cuotas

**Nuevas claves en `app_settings`:** `telegram_ai_enabled`, `ai_provider`, `telegram_ai_model`, `anthropic_api_key`, `openai_compatible_api_key`, `openai_compatible_base_url`, `telegram_plan_basic_limit`, `telegram_plan_pro_limit`, `telegram_plan_unlimited_limit`, `telegram_webhook_secret`.

**Proveedor de IA configurable:** soporta `anthropic` (Claude) y `openai_compatible` (Qwen, Groq, OpenAI, etc.). Por defecto configurado para **Qwen** via `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. Para agregar un nuevo proveedor, solo se necesita una `baseURL` compatible con la API de OpenAI.

**Intenciones soportadas:** `stock_query`, `stock_alerts`, `sales_summary`, `top_products`, `sales_report_excel` (genera y envía .xlsx), `promotions_query`, `daily_orders`, `unknown`.

**API Routes:**
- `POST /api/telegram/webhook` — endpoint público, autenticado via `X-Telegram-Bot-Api-Secret-Token`
- `GET/POST /api/telegram/chats` — listar y agregar chats autorizados
- `PUT/DELETE /api/telegram/chats/[id]` — editar o revocar acceso

**UI:** `/(admin)/settings` → tab "Bot de IA". Incluye configuración del proveedor/modelo/límites y tabla de chats autorizados con indicador de consumo diario.

**Setup manual requerido:**
1. Registrar el webhook en Telegram: `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://dominio.com/api/telegram/webhook&secret_token=SECRET`
2. Configurar API key del proveedor de IA en `/(admin)/settings`
3. Agregar los chats autorizados en la misma pantalla

---

### Módulo 16 — Anulación de Órdenes

Permite anular órdenes ya confirmadas, tanto desde el POS (tab "Pedidos del día") como desde el panel de reportes del admin.

**Reglas de negocio:**
- Cajero: puede anular órdenes propias del día en curso.
- Admin: puede anular cualquier orden.
- Al anular, se restaura el stock automáticamente via `reverseStock()`.
- Los campos `cancelled_at`, `cancelled_by` y `cancel_reason` se registran en `orders`.
- Las órdenes anuladas se excluyen de: reportes de ventas, reportes de productos más vendidos, reportes por cajero, vista de cocina (KDS) y badge de pedidos pendientes del POS.
- El stock negativo en `branch_stock` está permitido (mínimo -99999) para casos donde se vende con stock cero.

**API:** `POST /api/orders/[id]/cancel`
**Componente:** `CancelOrderModal` (reutilizado en POS y reportes)

---

## 7. API Routes

Todas las API routes requieren header `Authorization: Bearer <token>` (excepto las de usuarios que usan service role key del servidor).

### Sucursales
```
GET    /api/branches              — Lista todas las sucursales
POST   /api/branches              — Crear sucursal
PUT    /api/branches/[id]         — Editar sucursal
PATCH  /api/branches/[id]         — Toggle activo/inactivo
```

### Productos
```
GET    /api/products              — Lista con variantes y precios
POST   /api/products              — Crear (con variantes, recetas, imagen)
PUT    /api/products/[id]         — Editar
DELETE /api/products/[id]         — Soft delete (is_active = false)
```

### Insumos
```
GET    /api/ingredients           — Lista
POST   /api/ingredients           — Crear
PUT    /api/ingredients/[id]      — Editar
DELETE /api/ingredients/[id]      — Eliminar
```

### Stock
```
GET    /api/stock?branchId=           — Stock actual de una sucursal
POST   /api/stock/purchase            — Registrar compra → suma stock
POST   /api/stock/adjust              — Ajuste manual de stock
GET    /api/stock/movements?branchId= — Historial de movimientos
GET    /api/stock/alerts?branchId=    — Insumos bajo mínimo
```

### Promociones
```
GET    /api/promotions?branchId=&date= — Lista (con filtro para POS)
POST   /api/promotions                 — Crear
PUT    /api/promotions/[id]            — Editar
DELETE /api/promotions/[id]            — Eliminar
```

### Órdenes
```
POST   /api/orders              — Crear orden + ítems + descontar stock automáticamente
POST   /api/orders/[id]/cancel  — Anular orden + restaurar stock automáticamente
```

### Usuarios (service role key)
```
GET    /api/users           — Lista de usuarios con perfil
POST   /api/users           — Crear usuario en Auth + profiles
PUT    /api/users/[id]      — Editar nombre/rol/sucursal
DELETE /api/users/[id]      — Soft delete
```

### Tipos de Variantes
```
GET    /api/variant-types
POST   /api/variant-types
PUT    /api/variant-types/[id]
DELETE /api/variant-types/[id]
```

### Bodega
```
GET    /api/warehouse/stock              — Stock de bodega (paginado, con filtros)
GET    /api/warehouse/stock/[id]         — Stock de un insumo específico
POST   /api/warehouse/purchase           — Compra a bodega
POST   /api/warehouse/transfer           — Transferencia bodega → sucursal
POST   /api/warehouse/adjust             — Ajuste de stock en bodega
GET    /api/warehouse/movements          — Historial de movimientos bodega
```

### Configuración (Módulo 17 — en desarrollo)
```
GET    /api/settings          — Lee config de Telegram (token enmascarado)
PUT    /api/settings          — Guarda config de Telegram
POST   /api/settings/test     — Prueba la conexión con token+chatId del body
```

### Bot de IA Telegram (Módulo 18 — en desarrollo)
```
POST   /api/telegram/webhook          — Endpoint público (Telegram lo llama por cada mensaje)
GET    /api/telegram/chats            — Lista chats autorizados con consumo del día
POST   /api/telegram/chats            — Agrega chat autorizado
PUT    /api/telegram/chats/[id]       — Edita plan/label/estado
DELETE /api/telegram/chats/[id]       — Revoca acceso
```

### Upload
```
POST   /api/upload    — Subir imagen a Supabase Storage (bucket product-images)
```

### Reportes
```
GET    /api/reports/sales?branchId=&from=&to=          — { total, count, avg }
GET    /api/reports/top-products?branchId=&from=&to=   — Array de productos más vendidos
GET    /api/reports/daily?branchId=&from=&to=          — Array { date, total } por día
GET    /api/reports/orders?branchId=&from=&to=         — Lista de órdenes con ítems
GET    /api/reports/cashiers?branchId=&from=&to=       — Ventas agrupadas por cajero
```

---

## 8. Librerías y Utilidades

### `src/lib/supabase.ts`

Cliente Supabase con anon key. Para uso client-side en componentes autenticados.

### `src/lib/auth.ts`

```typescript
getUserProfile()   // Consulta tabla profiles con la sesión activa
signIn(email, password)
signOut()
```

**Tipo `UserRole`:** `"admin" | "cajero" | "cocinero"`

### `src/lib/authProvider.ts`

Implementación de Refine `AuthProvider`. El método `getIdentity()` retorna `{ id, name, role, branch_id, avatar }`. Gestiona redirección post-login según rol.

### `src/lib/promotions.ts`

Motor de promociones — **lógica de negocio pura, sin UI ni estado**.

| Función | Descripción |
|---------|-------------|
| `getActivePromotions(promotions, branchId, date)` | Filtra promos por sucursal, fecha y día de semana |
| `applyPromotions(cartItems, activePromotions)` | Aplica todos los tipos al carrito |
| `applyBuyXGetY(items, promo)` | Implementa la lógica de unidades gratuitas y qty_physical |
| `applyPercentage(items, promo)` | Aplica descuento porcentual |
| `applyCombo(items, promo)` | Aplica precio especial de combo con distribución proporcional |
| `getTotalDiscount(items)` | Suma total de descuentos aplicados |
| `getCartTotal(items)` | Total final del carrito (precio pagado) |

**Concepto central:** BUY_X_GET_Y actualiza `qty_physical` (unidades que salen de cocina) sin cambiar `qty` (unidades cobradas).

### `src/lib/recipes.ts`

```typescript
deductStock(orderId, branchId, token, userId, orderType)
reverseStock(orderId, branchId, token, userId)
```

**`deductStock`** — llamada post-venta:
1. Obtiene los ítems de la orden con sus variantes y recetas.
2. Filtra recetas por `apply_condition` vs `orderType`.
3. Calcula la deducción total por insumo: `recipe.quantity × qty_physical`.
4. Actualiza `branch_stock` y registra en `stock_movements` con tipo `venta`.

**`reverseStock`** — llamada post-anulación (espejo de `deductStock`):
1. Obtiene los ítems de la orden con sus variantes y recetas.
2. Calcula el stock a restaurar: `recipe.quantity × qty_physical`.
3. Actualiza `branch_stock` sumando el stock devuelto.
4. Registra en `stock_movements` con tipo `anulacion`.

### `src/lib/timezone.ts`

Bolivia Time (UTC-4, sin cambio de horario estacional).

| Función | Descripción |
|---------|-------------|
| `nowInBolivia()` | Fecha y hora actual en BOT |
| `todayInBolivia()` | Fecha actual en formato YYYY-MM-DD |
| `dayOfWeekInBolivia()` | Número 0–6 (0 = domingo) |
| `toBoliviaDate(utcDate)` | Convierte fecha UTC a BOT |
| `formatTimeBolivia(date)` | Formato HH:MM AM/PM |
| `dateRangeFrom(date)` | Inicio del día en UTC para queries Supabase |
| `dateRangeTo(date)` | Fin del día en UTC para queries Supabase |

**Uso crítico:** el POS usa `todayInBolivia()` para cargar las promociones del día. Sin esto, a las 20:00 hora boliviana (00:00 UTC) se cargarían las promos del día siguiente.

### `src/lib/warehouse.ts`

Operaciones de bodega central.

| Función | Descripción |
|---------|-------------|
| `registerPurchase(...)` | Compra a bodega: suma `warehouse_stock`, inserta movimiento |
| `transferToBranch(...)` | Bodega → sucursal: resta warehouse, suma branch_stock |
| `adjustWarehouseStock(...)` | Ajuste físico en bodega |
| `getWarehouseStock(...)` | Stock paginado con filtros (bajo mínimo, por insumo) |
| `getWarehouseMovements(...)` | Historial con filtros (tipo, insumo, sucursal, fecha) |

---

## 9. Internacionalización (i18n)

**Librería:** `next-intl` (integración nativa con Next.js 14 App Router)

**Idiomas:**
- Español (`es`) — default
- Inglés (`en`)

**Archivos:**
- `messages/es.json` — Todas las traducciones en español
- `messages/en.json` — Traducciones en inglés
- `src/i18n/request.ts` — Lee el locale desde cookies

**Convención:** El código se escribe en inglés (variables, funciones, comentarios). La UI se muestra en español por defecto.

---

## 10. Comunicación en Tiempo Real

### BroadcastChannel API (POS ↔ Display)

El POS y el display cliente se comunican sin internet, sin Supabase Realtime, solo mediante la BroadcastChannel API del navegador. Requieren estar en la misma PC en el mismo navegador.

**Canal:** `"pos-display"`

**Mensajes del POS al Display:**

| type | data | Descripción |
|------|------|-------------|
| `cart:update` | Array de cart items | Cajero actualizó el carrito |
| `order:confirm` | `{ orderNumber }` | Venta confirmada |
| `order:clear` | — | Carrito vaciado / nueva venta |

**Estados del Display:**
- Recibe `cart:update` → cambia a modo `order`
- Recibe `order:confirm` → cambia a modo `thanks`
- Carrito vacío → vuelve a modo `menu`

---

## 11. Flujos Críticos del Sistema

### Flujo de Venta Completo

```
1. Cajero abre /pos
2. Sistema detecta su branch_id desde profiles
3. Carga productos de esa sucursal (con precios de branch_prices si aplica)
4. Carga promociones activas del día (getActivePromotions con todayInBolivia())
5. Cajero selecciona producto → VariantSelectorModal
6. Al agregar al carrito: applyPromotions() calcula descuentos y qty_physical
7. BroadcastChannel envía cart:update al Display
8. Display muestra los ítems y total en tiempo real al cliente
9. Cajero selecciona tipo de orden (dine_in/takeaway) y método de pago
10. Confirmar venta:
    a. POST /api/orders con order + items
    b. Se genera daily_number (SELECT + 1 por sucursal y fecha)
    c. Se insertan order_items con qty, qty_physical, discount_applied, promo_label
    d. deductStock() descuenta branch_stock según recetas y apply_condition
    e. Inserta stock_movements tipo 'venta' por cada insumo descontado
11. BroadcastChannel envía order:confirm al Display
12. Display muestra pantalla de agradecimiento con número de orden
13. Cocina ve la orden en /kitchen con estado 'pending'
14. Cocinero marca la orden como 'ready'
```

### Flujo de Descuento de Stock por Receta

```
deductStock(orderId, branchId, token, userId, orderType):
  1. Fetch order_items JOIN product_variants JOIN recipes JOIN ingredients
  2. Para cada item:
     - Verificar apply_condition vs orderType
     - Si no aplica (ej: recipe es 'dine_in' pero orden es 'takeaway') → skip
     - Deducción = recipe.quantity × item.qty_physical
  3. Agrupar deducción total por ingredient_id
  4. UPDATE branch_stock: quantity -= deducción
  5. INSERT stock_movements (type='venta', origin=null)
```

### Flujo de Anulación de Orden

```
1. Cajero o admin hace clic en "Anular" en DayOrdersPanel o tabla de reportes
2. Se abre CancelOrderModal — el usuario ingresa un motivo (opcional)
3. POST /api/orders/[id]/cancel con { reason }
4. API valida rol: cajero solo puede anular órdenes propias del día; admin sin restricción
5. Se actualiza orders: cancelled_at = now(), cancelled_by = userId, cancel_reason
6. reverseStock() restaura branch_stock por cada insumo de la receta
7. INSERT stock_movements con type = 'anulacion' por cada insumo revertido
8. La orden aparece con tag rojo "Anulada" en DayOrdersPanel
9. La cocina descarta la tarjeta automáticamente (excluye cancelled_at IS NOT NULL)
```

### Flujo del Motor de Promociones

```
applyPromotions(cartItems, activePromotions):
  Para cada promo activa:
    - BUY_X_GET_Y: por cada grupo de buy_qty items, add get_qty free
      → qty no cambia (sigue siendo lo que paga)
      → qty_physical aumenta (unidades que salen)
      → discount = precio_unitario × unidades_gratis
    - PERCENTAGE: discount = precio × (discount_percent/100)
      → qty_physical = qty (no hay unidades extra)
    - COMBO: precio_total_combo - suma_precios_individuales = descuento
      → distribuye el descuento proporcionalmente entre los ítems del combo
```

---

## 12. Variables de Entorno

```bash
# Público (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...

# Servidor únicamente
SUPABASE_SERVICE_ROLE_KEY=eyJhb...   # Usado en /api/users y reportes

# Opcional
NEXT_PUBLIC_APP_VERSION=1.0.0

# Bot de IA (alternativa a configurar en app_settings via UI)
OPENAI_COMPATIBLE_API_KEY=sk-...       # API key de Qwen u otro proveedor compatible
OPENAI_COMPATIBLE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
ANTHROPIC_API_KEY=sk-ant-...           # Solo si se usa proveedor Anthropic
```

---

## 13. Comandos de Desarrollo

```bash
npm run dev           # Servidor de desarrollo (ejecutado por el usuario, no por Claude)
npm run build         # Build de producción (ejecutado por el usuario, no por Claude)
npm run build:local   # Build con .env.local
npm run start         # Servidor de producción
npm run lint          # ESLint
npx tsc --noEmit      # Verificación de tipos TypeScript (Claude puede ejecutar esto)
```

> **Regla:** Claude **nunca** ejecuta `npm run dev` ni `npm run build`. El usuario los ejecuta manualmente.

---

## 14. Convenciones de Código

### Idioma
- **Código:** inglés (variables, funciones, componentes, comentarios, nombres de archivos)
- **UI:** español (labels, mensajes, textos visibles al usuario)

### Moneda
- **Bs** (bolivianos) — nunca `$`

### Formateo de Fechas
- Interno: `YYYY-MM-DD`
- Queries Supabase: usar `dateRangeFrom` / `dateRangeTo` de `timezone.ts`
- Display: formato local español

### Reglas de Arquitectura (resumen)
- `page.tsx` solo layout — importa hooks y componentes, sin lógica ni queries
- `hooks/` maneja estado y llama a `services/`
- `services/` solo comunicación con backend/Supabase, sin estado
- `components/` solo UI, recibe props, sin queries directas

### TypeScript
- Strict mode activado
- Path alias: `@/*` → `src/*`
- Interfaces en `features/<nombre>/types/`

---

## 15. Estado Actual y Pendientes

### Módulos Completados ✅

| # | Módulo | Feature |
|---|--------|---------|
| 01 | Project Setup | Configuración base |
| 02 | Base de Datos | Schema + RLS + migraciones |
| 03 | Auth | Login, roles, redirección |
| 04 | Insumos | CRUD completo |
| 05 | Productos | Wizard 3 pasos + imagen |
| 06 | Inventario / Stock | 4 tabs: actual/compra/ajuste/historial |
| 07 | Promociones | BUY_X_GET_Y, PERCENTAGE, COMBO |
| 08 | POS | Completo con promos, pago, display |
| 09 | Display Cliente | BroadcastChannel, 3 modos |
| 10 | Reportes | Charts + tablas + Excel export |
| — | Usuarios | CRUD con service role key |
| — | Número de orden diario | Secuencial por sucursal/día |
| 11 | Dashboard | Cards + charts + alertas dobles |
| 12 | KDS (Kitchen Display) | Cocinero con alertas de tiempo |
| 13 | Bodega Central | Warehouse separado de sucursal |
| 14 | Tipo de Orden + Condición Receta | dine_in vs takeaway |
| 15 | Tipos de Variantes | Tamaños configurables |
| 16 | Anulación de Órdenes | Con reversión automática de stock |

### Pendientes ⏳

| Módulo | Estado | Detalle |
|--------|--------|---------|
| 17 — Notificaciones Telegram | En desarrollo | Código completo en `main`. Falta: aplicar migración `019_app_settings.sql` en Supabase y configurar bot token + chat ID en `/(admin)/settings` |
| 18 — Bot de IA Telegram | En desarrollo | Código completo en `main`. Falta: aplicar migración `020_telegram_ai_bot.sql`, registrar webhook en Telegram, configurar API key de Qwen y agregar chats autorizados |
| 11 — PWA | Pendiente | `next-pwa` y `manifest.json` configurados. Faltan íconos PNG (192×192 y 512×512) en `public/icons/` y meta tags iOS en `layout.tsx` (`apple-mobile-web-app-capable`, `theme-color`, `apple touch icon`) |

### Funcionalidades Futuras (Planificadas)

- Pedidos para llevar y delivery
- Gestión de mesas
- Integración con impresora de tickets
- App móvil nativa

### Tests

**Playwright E2E:**
- `tests/auth.spec.ts`
- `tests/branches.spec.ts`
- `tests/example.spec.ts`

**Planes de prueba manual en** `docs/tests/manual/`:
- auth, branches, ingredients, products, stock, promotions, pos, display, kitchen, reports, soft-delete

**Planes de prueba automatizados en** `docs/tests/automation/`:
- auth, branches, ingredients, products, stock, promotions, pos, kitchen, reports

---

*Documentación generada en base al estado real del código — Marzo 2026 (actualizada 2026-03-20)*


#production

# 1. Traer el código nuevo al server (el build usa context: . → código en disco del server)
git pull origin main

# 2. Reconstruir solo la imagen de pippo-backend
docker compose build pippo-backend

# 3. Recrear solo ese contenedor con la imagen nueva, sin reiniciar ai-orchestrator
docker compose up -d --no-deps pippo-backend
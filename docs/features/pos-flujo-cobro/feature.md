# Flujo de cobro configurable (POS)

## Estado

**Implementado.** Backend (nuevas claves en `app_settings` + endpoint `/settings/pos-checkout`), frontend (Configuración → POS arma el flujo; el POS lo consume). Sin migración de BD: `app_settings` ya existía. Sin tests automatizados nuevos más allá del spec de settings ya existente.

## Objetivo

Que cada negocio arme el cobro como lo maneja su local, en vez del flujo fijo de dos pasos igual para todos. Salió de dos pedidos concretos: locales que no trabajan con Pedidos Ya y les estorba el atajo, y locales de mostrador que quieren cobrar más rápido.

Una venta típica pasaba de **5 toques** (Cobrar → tipo → método → Continuar → Confirmar) a **2** con todo configurado (Cobrar → Cobrar).

## Decisiones confirmadas con el usuario

- **Es configuración, no un módulo de superadmin.** Vive en `app_settings` (clave-valor por negocio), autoservicio del admin en Configuración → POS, junto a `pos_enable_table_number` que ya estaba ahí. A diferencia de `cashbox`, no toca dinero ni expone nada público: es preferencia operativa.
- **Alcance por negocio, no por sucursal.** `app_settings` no tiene `branch_id`; agregarlo es un refactor aparte. Si aparece la necesidad real (una sucursal hace delivery y otra no), es fase 2.
- **Todos los defaults reproducen el flujo anterior.** Un negocio que nunca entra a Configuración no nota ningún cambio.
- **Preselección ≠ esconder.** Un tipo de pedido preseleccionado entre varios viene marcado pero el cajero puede cambiarlo; la sección solo desaparece cuando queda **un solo** tipo habilitado, porque ahí no hay decisión que tomar.
- **Solo efectivo y QR son preseleccionables.** Preseleccionar "mixto" pediría partir un monto antes de que el cajero toque nada, y "por cobrar" dejaría ventas impagas por descuido.
- **Saltear la confirmación no se lleva el vuelto.** La calculadora de vuelto se muestra en el paso 1 cuando la venta tiene efectivo. Lo que se pierde es la revisión del carrito, y eso queda advertido en la propia pantalla de Configuración.
- **No se puede dejar el POS sin opciones.** Ni la lista de tipos de pedido ni la de métodos de pago pueden quedar vacías: bloqueado en la UI, validado en el DTO (`@ArrayNotEmpty`) y con fallback al default al leer una fila rota.

## Claves nuevas en `app_settings`

| Clave | Default | Qué controla |
|---|---|---|
| `pos_order_types` | `["dine_in","takeaway","delivery"]` | Tipos visibles al cobrar |
| `pos_default_order_type` | `""` (sin preselección) | Tipo marcado al abrir el cobro |
| `pos_enable_pedidos_ya` | `true` | Atajo de Pedidos Ya |
| `pos_payment_methods` | `["efectivo","qr","mixto","deferred"]` | Métodos visibles (también en el cobro diferido) |
| `pos_default_payment_method` | `""` | Método marcado al abrir el cobro |
| `pos_enable_notes` | `true` | Campo de nota del pedido |
| `pos_skip_confirm_step` | `false` | Cierra la venta en el paso 1 |

## Diseño técnico

- **Contrato compartido**: `packages/shared/src/constants/pos-checkout.ts` — opciones válidas, `PosCheckoutConfig`, defaults y los dos `resolveDefault*` que usan POS y Configuración, para que no puedan interpretar distinto la misma config.
- **Backend**: `SettingsService.parsePosCheckoutSettings` es el único parseo, usado por `getSettings` (plano, para Configuración) y por `getPosCheckoutConfig` (anidado, para el POS). `GET /settings/pos-checkout` **reemplaza** a `/settings/pos-table-number`: el POS necesitaba las dos cosas y no tenía sentido pagar dos round trips.
- **Frontend POS**: la config viaja con el catálogo (`PosCatalogCache`), así el modal de cobro también se arma offline. Una entrada cacheada por una versión anterior no tiene `checkout` y cae al default hasta el próximo refresh.
- **Cierre directo**: `handlePaymentConfirm` recibe `{ skipConfirm, cashReceived }` y, cuando aplica, llama a `handleConfirmSale` con un `SaleDraft` explícito — el estado recién seteado no está disponible en el mismo tick, y leerlo ahí cerraría la venta con los datos de la **anterior**.
- `PaymentModal` se partió (ya estaba sobre el límite de 200 líneas del proyecto): `OrderTypeSection`, `PedidosYaShortcut`, `SaleNotesField` salieron a sus propios componentes.

## Fuera de alcance

- Configuración por sucursal.
- El panel de Mesero: arma sus pedidos por su cuenta y no lee esta config (sí la respeta el cobro diferido desde el POS).
- Presets ("mostrador rápido", "solo delivery") — existen en el mockup como atajo para explicar la feature, no en la UI.

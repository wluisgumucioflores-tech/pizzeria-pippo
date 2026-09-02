# Ejemplos de chat — ai-orchestrator

Prompts de prueba manual contra `POST /chat/tools`, organizados por dominio. Referencia cruzada: `catalogo-tools.md` tiene el detalle de cada tool; esto es solo "qué escribir en el chat para probarla". Se actualiza junto con el catálogo cada vez que se agrega una tool nueva.

Todos los ejemplos de escritura (`createX`) requieren `role: "admin"` — con `cajero` esas tools ni se le ofrecen al modelo. Las de `stock` además requieren que el plan del negocio tenga `stock` en `allowed_write_domains` (ver `catalogo-tools.md`) — sin eso, ni siendo admin se ofrecen.

---

## sales

- Con sucursal pre-resuelta (cajero, o admin con una sola sucursal, o admin que ya eligió una en el selector del widget): "¿Cuánto se vendió hoy?" → el modelo debe responder directo con esa sucursal, **sin** llamar `getBranches` ni preguntar cuál.
- Con admin multi-sucursal y selector en "Todas": "¿Cuánto se vendió hoy?" → sin `branchId` en el contexto, se comporta como antes (todas las sucursales, o pregunta/usa `getBranches` si hace falta desambiguar).
- "¿Cuánto se vendió hoy?"
- "Dame el top 5 de productos más vendidos de este mes"
- "¿Cómo van las ventas día a día de la última semana?"
- "¿Cuánto vendió cada cajero ayer?"
- "Mostrame las últimas 10 órdenes"

## stock

- "¿Qué ingredientes están por agotarse?"
- "¿Cuánto stock de queso mozzarella tengo?"
- "¿Qué movimientos de stock hubo hoy?"
- "Compré 50kg de harina para la sucursal Centro" → `purchaseStock`: resuelve sucursal (`getBranches`) e ingrediente (`getStock`), suma al stock existente.
- "El stock real de mozzarella en Centro es 12kg" (conteo físico) → `adjustStock`: sobrescribe a esa cantidad, no suma. El modelo debe confirmar que es la cantidad final, no una resta.
- Caso incompleto: "Compré harina" (sin cantidad ni sucursal) → debe preguntar antes de llamar la tool.
- Caso plan sin habilitar: si el plan del negocio no tiene `stock` en `allowed_write_domains`, aunque sea admin la tool ni se ofrece — el modelo debe responder que no puede registrar compras/ajustes, solo consultar (mismo texto genérico del system prompt para "no tengo herramienta para eso").

## branches

- "¿Qué sucursales tengo?"
- "Creá la sucursal Norte en Av. Siempre Viva 123" → `createBranch`, sin ambigüedad. Solo requiere `role: "admin"`, no depende del plan (ver `catalogo-tools.md`).
- Caso incompleto: "Agregá una sucursal nueva" (sin nombre) → debe preguntar el nombre antes de llamar la tool (address/phone/horario son opcionales, no hace falta insistir en esos).

## ingredients

- "¿Qué insumos tengo cargados?"
- "Creá el insumo Queso mozzarella, se mide en kg" → `createIngredient`, sin ambigüedad.
- Caso incompleto: "Agregá un insumo nuevo" (sin nombre/unidad) → debe preguntar antes de llamar la tool.
- Caso de negocio: "Agregá el insumo Harina" (ya existe) → el modelo debería consultar `getIngredients` primero y avisar que ya existe en vez de crear un duplicado.

## variantTypes

- "¿Qué tamaños de variante tengo disponibles?"
- "Creá el tamaño Extra Grande" → `createVariantType`, sin ambigüedad.
- Caso de negocio: "Agregá el tamaño Mediana" (ya existe) → el modelo debería consultar `getVariantTypes` primero y avisar que ya existe en vez de crear un duplicado.

## categories

- "¿Qué categorías de producto tengo?"
- "Creá la categoría Postres" → sin ambigüedad, llama directo con `isPizza=false` (o vacío).
- "Creá una categoría de pizzas llamada Pizzas Artesanales" → `isPizza=true`.

## products

- "¿Qué productos tengo en la categoría Pizzas?"
- "Agregá una pizza Cherry a Bs35" → si el negocio tiene varias sucursales, el modelo debe **preguntar** si el precio es igual en todas antes de llamar a la tool (no asumir).
- "Creá el producto Coca Cola 2L a Bs15, es reventa" → sin ambigüedad de tipo (`resale`), directo.
- "Agregá una pizza Hawaiana a Bs40, chica Bs30 y familiar Bs55" → variantes con precios distintos, una sola sucursal o precio igual en todas.
- Caso incompleto: "Agregá un producto nuevo" (sin nombre/precio/categoría) → el modelo debe pedir los datos faltantes, no inventar.

## promotions

**Directo, sin ambigüedad** (todos los datos dados):
- "Creá una promoción 2x1 de la pizza Cherry, todos los días, del 1 al 30 de septiembre"
- "Creá un 20% de descuento en todo el catálogo, de lunes a viernes, del 1 al 7 de septiembre"
- "Creá un combo de pizza mediana + gaseosa a Bs50, fines de semana, todo septiembre"

**Incompleto — debe preguntar antes de llamar la tool**:
- "Quiero crear la promoción 2x1 para todos los productos" → `BUY_X_GET_Y` no tiene wildcard "todos los productos" (ver `catalogo-tools.md`); el modelo debe preguntar a qué producto(s) específico(s) aplica, además de fechas y días si tampoco se dieron.
- "Armá una promo de descuento" → falta tipo de dato clave (¿porcentaje de cuánto? ¿fechas? ¿días?) — el modelo debe pedir esos datos antes de llamar `createPromotion`.
- "Creá una promoción para la sucursal Norte" → sin tipo/fechas/producto, el modelo debe seguir preguntando; solo debe resolver `branchId` con `getBranches` una vez tenga el resto.

**Por tipo, para validar cada shape de `rules`**:
- `BUY_X_GET_Y`: "2x2 en cerveza, todos los días de agosto" (2 unidades pagás, 2 gratis)
- `PERCENTAGE` sin producto: "10% off en todo el pedido, solo los martes de septiembre"
- `PERCENTAGE` con producto: "15% de descuento en la pizza Pepperoni, todo el mes"
- `COMBO` slot flexible: "Combo cualquier pizza mediana + cualquier bebida a Bs45"

---

## Notas para probar manualmente

- Cambiar `role` en el request entre `admin`/`cajero` para confirmar que las tools de escritura desaparecen del set ofrecido al modelo con `cajero`.
- Los ejemplos "incompletos" de promociones/productos son los más importantes para validar — ahí es donde vive la lógica de negocio (la descripción del `@Tool`, no código), y es lo que más fácil se rompe si se toca el wording de esas descripciones.

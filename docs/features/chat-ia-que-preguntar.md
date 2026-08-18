# Chat de IA del panel admin — qué se le puede preguntar

Guía de uso para el asistente de IA del ícono flotante (abajo a la derecha del panel admin). Responde en el idioma en que esté configurado el panel (español o inglés) y solo consulta información — no puede crear, editar ni borrar nada.

## Qué sabe consultar (v1, solo lectura)

El agente tiene acceso a 5 herramientas, cada una atada a un endpoint real del backend:

### 1. Ventas del período (`/reports/sales`)
Total vendido, cantidad de pedidos, ticket promedio, desglose por tipo de pedido (en el local / para llevar / delivery / Pedidos Ya) y por forma de pago (efectivo, QR, online, mixto).

Ejemplos:
- "¿cuánto se vendió hoy?"
- "dame el resumen de ventas del 1 al 15 de agosto de 2026"
- "¿cuánto entró en efectivo esta semana?"

### 2. Productos más vendidos (`/reports/top-products`)
Top 5 productos por cantidad vendida en un rango de fechas.

Ejemplos:
- "¿cuáles son los productos más vendidos del mes?"
- "top de productos vendidos el 15 de agosto de 2026"

### 3. Alertas de stock (`/stock/alerts`)
Ingredientes cuya cantidad actual está por debajo del mínimo configurado.

Ejemplos:
- "¿hay stock bajo en alguna sucursal?"
- "¿qué ingredientes están por agotarse?"

### 4. Promociones (`/promotions`)
Listado de promociones, activas por defecto (podés pedir que incluya las inactivas).

Ejemplos:
- "¿qué promociones están activas ahora?"
- "mostrame todas las promociones, incluidas las inactivas"

### 5. Productos (`/products`)
Listado de productos del menú, activos por defecto, con búsqueda por texto y filtro por categoría (`pizza`, `bebida`, `otro`).

Ejemplos:
- "¿qué productos tengo en la categoría bebidas?"
- "buscá productos que tengan 'muzza' en el nombre"

## Filtrar por sucursal — limitación conocida

Los reportes y alertas de stock aceptan filtrar por sucursal, pero el agente necesita el **UUID real** de la sucursal, no su nombre — y no tiene forma de resolver "sucursal Centro" a ese UUID. Si preguntás por una sucursal específica por nombre, el agente va a ignorar ese filtro y responder con los datos de **todas** las sucursales del negocio (no es un error, es el comportamiento esperado hasta que se agregue esa resolución).

## Fechas

Funciona mejor con fechas explícitas ("del 1 al 15 de agosto de 2026") que con expresiones relativas ("esta semana", "el mes pasado") — el agente conoce la fecha actual, pero es más confiable ser específico, sobre todo con modelos locales chicos.

## Lo que todavía no hace (fuera de alcance de v1)

- No puede crear, editar ni eliminar nada (pedidos, productos, promociones, stock) — todo lo que hace es de solo lectura.
- No tiene memoria entre sesiones: cada vez que abrís el ícono del chat arranca una conversación nueva.
- No genera reportes de cajeros ni de pedidos detallados (`/reports/cashiers`, `/reports/orders`) — todavía no están en el allowlist de herramientas.

## Nota sobre el modelo usado

La calidad y velocidad de las respuestas dependen del proveedor/modelo configurado en **Settings → Chat IA**. Con modelos locales chicos (ej. Ollama + `qwen2.5:3b-instruct`) las respuestas son más rápidas pero puede fallar más seguido en elegir la herramienta correcta o inventar un parámetro — con Anthropic o modelos más grandes es más confiable. El chat siempre puede cometer errores; verificá los datos importantes antes de tomar decisiones basadas en su respuesta.

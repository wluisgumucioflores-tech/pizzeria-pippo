-- Permite reabrir un pedido dine-in ya marcado "listo" en cocina cuando el
-- cliente pide algo más (ej. otra pizza o bebida), en vez de forzar un
-- pedido nuevo que se confunde con el original al momento de cobrar.
--
-- order_items.created_at distingue ítems originales de los agregados
-- después de reabrir — se llena solo (DEFAULT now()) tanto en el insert vía
-- create_order_atomic (pedido nuevo) como en el insert de Prisma en
-- addItemsToOrder (agregar a uno existente), no hace falta tocar la función.
--
-- orders.last_ready_at se setea cada vez que cocina marca "listo". Comparando
-- order_item.created_at > orders.last_ready_at se sabe qué ítems son nuevos
-- tras la reapertura, sin importar cuántas veces se reabra el pedido.

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_ready_at timestamptz;

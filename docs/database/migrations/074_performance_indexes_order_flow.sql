-- 074_performance_indexes_order_flow.sql
--
-- Missing indexes on the cashier -> kitchen hot path.
--
-- Context: every sale (POST /orders -> create_order_atomic) and every kitchen /
-- day-orders fetch walks these tables through their foreign keys, but Postgres
-- does NOT create an index for a FK automatically. Only order_item_extras and
-- order_payments got one (idx_order_item_extras_order_item /
-- idx_order_payments_order); the rest were left as sequential scans, which is
-- why the flow was fast on a small database and degraded as volume grew.
--
-- All of these are plain CREATE INDEX (not CONCURRENTLY) because the Supabase
-- SQL Editor wraps statements in a transaction and CONCURRENTLY cannot run
-- inside one. Each takes a brief ACCESS EXCLUSIVE lock on its table, so run
-- this outside peak selling hours.

-- 1. order_items(order_id) — the most important one. Hit by getDayOrders,
--    getPendingKitchenOrders, every report and every order detail.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON public.order_items USING btree (order_id);

-- 2. order_item_flavors(order_item_id) — mixed pizzas in the kitchen view.
CREATE INDEX IF NOT EXISTS idx_order_item_flavors_order_item
    ON public.order_item_flavors USING btree (order_item_id);

-- 3. branch_stock(branch_id, ingredient_id) — create_order_atomic runs one
--    UPDATE ... WHERE branch_id = ? AND ingredient_id = ? per ingredient,
--    while holding the per-branch advisory lock. Without this index each of
--    those is a sequential scan blocking every other sale in the branch.
CREATE INDEX IF NOT EXISTS idx_branch_stock_branch_ingredient
    ON public.branch_stock USING btree (branch_id, ingredient_id);

-- 4. branch_prices(variant_id, branch_id) — resolveOrderItems loads
--    branchPrices for every variant in the cart on every sale.
CREATE INDEX IF NOT EXISTS idx_branch_prices_variant_branch
    ON public.branch_prices USING btree (variant_id, branch_id);

-- 5. recipes(variant_id) — loaded on every sale to compute stock deductions.
CREATE INDEX IF NOT EXISTS idx_recipes_variant
    ON public.recipes USING btree (variant_id);

-- 6. promotions(business_id) — PromotionsService.list() runs on every sale.
CREATE INDEX IF NOT EXISTS idx_promotions_business
    ON public.promotions USING btree (business_id);

-- 7. stock_movements(branch_id, created_at) — one INSERT per ingredient per
--    sale, plus the movements history screen. product_stock_movements already
--    had its equivalent (idx_product_stock_movements_branch_variant).
CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_created
    ON public.stock_movements USING btree (branch_id, created_at);

-- 8. Partial index matching getPendingKitchenOrders exactly
--    (branchId + kitchenStatus 'pending' + cancelledAt null, ordered by
--    created_at). Pending orders are a tiny slice of the table, so the partial
--    index stays small and the kitchen screen reads only live rows.
CREATE INDEX IF NOT EXISTS idx_orders_branch_kitchen_pending
    ON public.orders USING btree (branch_id, created_at)
    WHERE kitchen_status = 'pending' AND cancelled_at IS NULL;

-- 9. product_variants(product_id) — catalog loads and every variant -> product
--    join in the order/kitchen reads.
CREATE INDEX IF NOT EXISTS idx_product_variants_product
    ON public.product_variants USING btree (product_id);

-- Refresh planner statistics so the new indexes get picked up immediately
-- instead of waiting for autovacuum.
ANALYZE public.order_items;
ANALYZE public.order_item_flavors;
ANALYZE public.branch_stock;
ANALYZE public.branch_prices;
ANALYZE public.recipes;
ANALYZE public.promotions;
ANALYZE public.stock_movements;
ANALYZE public.orders;
ANALYZE public.product_variants;

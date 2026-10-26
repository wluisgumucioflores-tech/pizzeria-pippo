-- 076_online_orders.sql
--
-- Pedidos online por QR — ver docs/features/pedidos-online-qr/
--
-- A customer scans a QR, picks products from the branch's public menu and
-- submits an order. That order is a REQUEST, not a sale: it lives here until
-- an admin or cashier confirms it, and only then does the normal sale path
-- (create_order_atomic) run and produce a row in `orders`.
--
-- Why not write straight into `orders` with an "awaiting confirmation"
-- status: every existing query treats a row in `orders` as a real sale. An
-- unconfirmed request there would show up in the cashier's day orders, sum
-- into the day's revenue in reports, reach the kitchen queue, burn a
-- daily_number (leaving gaps when it expires), deduct stock, and need a fake
-- profile for the NOT NULL orders.cashier_id. Six surfaces to patch with new
-- filters, each one a place where a bug leaks into the business's sales
-- numbers — for what is, in the end, an inbox. Keeping requests in their own
-- table means confirming reuses the sale path untouched, and expiring one is
-- just a status change with zero risk to sales data.
--
-- Expiry is NOT a delete: "how many online orders did I lose by not
-- attending them" is exactly the number an owner wants to see.

CREATE TABLE IF NOT EXISTS public.online_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    -- Which branch the QR belongs to. Prices are per-branch (branch_prices),
    -- so a public menu cannot even be built without knowing the branch.
    branch_id uuid NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    -- Always recomputed server-side from branch_prices/base_price. The price
    -- the public client sends is never trusted.
    total numeric NOT NULL,
    status text DEFAULT 'pending' NOT NULL,
    -- Unguessable handle the anonymous customer polls its own order with.
    -- Never the row id: the response carries a real person's name and phone.
    public_token text NOT NULL,
    -- The sale this request became, NULL until confirmed. This column is the
    -- whole bridge between "request" and "sale".
    order_id uuid,
    notes text,
    reject_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT online_orders_pkey PRIMARY KEY (id),
    CONSTRAINT online_orders_business_fk FOREIGN KEY (business_id)
        REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT online_orders_branch_fk FOREIGN KEY (branch_id)
        REFERENCES public.branches(id) ON DELETE CASCADE,
    -- No cascade: deleting a sale must never silently erase the request it
    -- came from, and vice versa.
    CONSTRAINT online_orders_order_fk FOREIGN KEY (order_id)
        REFERENCES public.orders(id),
    CONSTRAINT online_orders_resolved_by_fk FOREIGN KEY (resolved_by)
        REFERENCES public.profiles(id),
    CONSTRAINT online_orders_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'expired'::text])),
    CONSTRAINT online_orders_total_check CHECK (total >= 0::numeric),
    -- A confirmed request must point at its sale; anything not confirmed must
    -- not. Cheap guard against a half-applied confirmation.
    CONSTRAINT online_orders_confirmed_has_order_check CHECK (
        (status = 'confirmed' AND order_id IS NOT NULL)
        OR (status <> 'confirmed' AND order_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS online_orders_public_token_unique
    ON public.online_orders USING btree (public_token);

-- The cashier's and admin's inbox: pending orders of one branch.
CREATE INDEX IF NOT EXISTS idx_online_orders_branch_status
    ON public.online_orders USING btree (branch_id, status, created_at DESC);

-- The expiry job: pending rows past their deadline, across all branches.
CREATE INDEX IF NOT EXISTS idx_online_orders_status_expires
    ON public.online_orders USING btree (status, expires_at);

-- Only set once confirmed, so most rows are NULL — partial index keeps it
-- small while still making "which request produced this sale" fast.
CREATE INDEX IF NOT EXISTS idx_online_orders_order_id
    ON public.online_orders USING btree (order_id)
    WHERE order_id IS NOT NULL;


-- One line of the customer's request. Deliberately simple: no flavors, no
-- extras, no promotions in v1 (see feature.md → "Fuera de alcance"). The
-- unit_price stored here is the server-resolved one at request time; it is
-- recomputed again at confirmation, because a price can change in between.
CREATE TABLE IF NOT EXISTS public.online_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    online_order_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT online_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT online_order_items_order_fk FOREIGN KEY (online_order_id)
        REFERENCES public.online_orders(id) ON DELETE CASCADE,
    CONSTRAINT online_order_items_variant_fk FOREIGN KEY (variant_id)
        REFERENCES public.product_variants(id),
    CONSTRAINT online_order_items_qty_check CHECK (qty > 0),
    CONSTRAINT online_order_items_unit_price_check CHECK (unit_price >= 0::numeric)
);

CREATE INDEX IF NOT EXISTS idx_online_order_items_order
    ON public.online_order_items USING btree (online_order_id);


-- orders.order_type gains 'online' — the sale a confirmed request becomes.
-- Unrelated to the existing payment_method 'online' (payments processed by an
-- app, with a payment_provider): different column, same word. Same situation
-- 'pedidos_ya' already had — see docs/features/mesero-y-mejoras-pos/.
--
-- Applied here rather than in a second migration so the whole feature is one
-- script to run in Supabase. Allowing the value before any code can produce
-- it is harmless.
DO $$
BEGIN
  ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
  ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check
    CHECK (order_type = ANY (ARRAY['dine_in'::text, 'takeaway'::text, 'delivery'::text, 'pedidos_ya'::text, 'online'::text]));
END
$$;

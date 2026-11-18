-- 077_cashbox.sql
--
-- Caja chica por turno — apertura, gastos y cierre de caja. Ver
-- docs/features/cashbox/. Gateado por enabled_modules.cashbox (off por
-- defecto, ver packages/shared/src/constants/business-modules.ts).
--
-- cash_sessions: una fila por turno de caja de una sucursal. Solo puede
-- existir una sesión 'open' por sucursal a la vez (índice único parcial
-- abajo) — eso es lo que permite al cron de auto-cierre (CashboxService)
-- detectar turnos que quedaron abiertos de un día anterior sin bloquear la
-- apertura del día siguiente.
--
-- El auto-cierre NO inventa un conteo: deja counted_amount/expected_amount/
-- difference en NULL y status='auto_closed', para que el reporte lo marque
-- como pendiente de revisión en vez de mostrar una caja que "cuadró" sin
-- haber sido contada.
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    opened_by uuid NOT NULL,
    opening_amount numeric NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'open' NOT NULL,
    -- Snapshot calculado al momento del cierre (apertura + ventas en
    -- efectivo del turno − gastos). Se guarda, no se recalcula después, para
    -- que ventas o gastos posteriores no alteren el cierre ya confirmado.
    expected_amount numeric,
    counted_amount numeric,
    difference numeric,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT cash_sessions_business_fk FOREIGN KEY (business_id)
        REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT cash_sessions_branch_fk FOREIGN KEY (branch_id)
        REFERENCES public.branches(id) ON DELETE CASCADE,
    CONSTRAINT cash_sessions_opened_by_fk FOREIGN KEY (opened_by)
        REFERENCES public.profiles(id),
    CONSTRAINT cash_sessions_closed_by_fk FOREIGN KEY (closed_by)
        REFERENCES public.profiles(id),
    CONSTRAINT cash_sessions_status_check CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'auto_closed'::text])),
    CONSTRAINT cash_sessions_opening_amount_check CHECK (opening_amount >= 0::numeric),
    -- Cerrada (manual o automáticamente) implica closed_at/closed_by; abierta
    -- implica que ninguno de los dos está puesto todavía.
    CONSTRAINT cash_sessions_closed_fields_check CHECK (
        (status = 'open' AND closed_at IS NULL AND closed_by IS NULL)
        OR (status IN ('closed', 'auto_closed') AND closed_at IS NOT NULL)
    )
);

-- Una sola sesión abierta por sucursal a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_branch
    ON public.cash_sessions USING btree (branch_id)
    WHERE status = 'open';

-- El reporte "Reportes → Caja": historial por sucursal y fecha.
CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch_opened
    ON public.cash_sessions USING btree (branch_id, opened_at DESC);

-- El cron de auto-cierre: sesiones abiertas, sin importar la sucursal.
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status
    ON public.cash_sessions USING btree (status)
    WHERE status = 'open';


-- cash_expenses: cada gasto de caja chica registrado durante un turno. No
-- existe fuera de una sesión — por eso session_id es NOT NULL y en cascada.
-- business_id/branch_id quedan denormalizados (mismo criterio que
-- orders.branch_id) para no tener que ir a cash_sessions en cada filtro de
-- reporte.
CREATE TABLE IF NOT EXISTS public.cash_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    business_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    amount numeric NOT NULL,
    category text NOT NULL,
    note text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_expenses_pkey PRIMARY KEY (id),
    CONSTRAINT cash_expenses_session_fk FOREIGN KEY (session_id)
        REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
    CONSTRAINT cash_expenses_business_fk FOREIGN KEY (business_id)
        REFERENCES public.businesses(id) ON DELETE CASCADE,
    CONSTRAINT cash_expenses_branch_fk FOREIGN KEY (branch_id)
        REFERENCES public.branches(id) ON DELETE CASCADE,
    CONSTRAINT cash_expenses_created_by_fk FOREIGN KEY (created_by)
        REFERENCES public.profiles(id),
    CONSTRAINT cash_expenses_category_check CHECK (category = ANY (ARRAY['insumos'::text, 'mantenimiento'::text, 'transporte'::text, 'otro'::text])),
    CONSTRAINT cash_expenses_amount_check CHECK (amount > 0::numeric)
);

-- El resumen de un turno abierto: todos los gastos de una sesión.
CREATE INDEX IF NOT EXISTS idx_cash_expenses_session
    ON public.cash_expenses USING btree (session_id);

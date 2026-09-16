-- ============================================================
-- 070_production_logs.sql
--
-- Phase 2 of docs/features/jefe-produccion/roadmap-fases.md — production
-- log: two simple tables, at the business level (NO branch yet, see
-- feature.md), recording what the `produccion` role reports manually.
-- They don't touch branch_stock/branch_product_stock or any real
-- stock — they're just a record/report for now.
--
-- Requires 069_production_role.sql to already be applied (adds the
-- 'produccion' role to profiles_role_check).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.production_ingredient_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
  quantity      NUMERIC NOT NULL,
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_ingredient_logs_business_id_idx ON public.production_ingredient_logs(business_id);
CREATE INDEX IF NOT EXISTS production_ingredient_logs_created_at_idx ON public.production_ingredient_logs(created_at);

CREATE TABLE IF NOT EXISTS public.production_output_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES public.businesses(id),
  variant_id   UUID NOT NULL REFERENCES public.product_variants(id),
  quantity     NUMERIC NOT NULL,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_output_logs_business_id_idx ON public.production_output_logs(business_id);
CREATE INDEX IF NOT EXISTS production_output_logs_created_at_idx ON public.production_output_logs(created_at);

-- RLS + GRANT + policies — mandatory checklist from docs/database/README.md.
-- Note: the NestJS backend connects with a role that bypasses RLS (see
-- DATABASE_URL), so this doesn't restrict the `produccion` role through
-- the API — it's just project convention for direct Supabase access.
ALTER TABLE public.production_ingredient_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_output_logs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.production_ingredient_logs TO authenticated;
GRANT ALL ON TABLE public.production_ingredient_logs TO service_role;
GRANT ALL ON TABLE public.production_output_logs TO authenticated;
GRANT ALL ON TABLE public.production_output_logs TO service_role;

CREATE POLICY "admin_select_production_ingredient_logs"
  ON public.production_ingredient_logs FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');
CREATE POLICY "admin_insert_production_ingredient_logs"
  ON public.production_ingredient_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "admin_update_production_ingredient_logs"
  ON public.production_ingredient_logs FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');
CREATE POLICY "admin_delete_production_ingredient_logs"
  ON public.production_ingredient_logs FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "admin_select_production_output_logs"
  ON public.production_output_logs FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');
CREATE POLICY "admin_insert_production_output_logs"
  ON public.production_output_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "admin_update_production_output_logs"
  ON public.production_output_logs FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');
CREATE POLICY "admin_delete_production_output_logs"
  ON public.production_output_logs FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

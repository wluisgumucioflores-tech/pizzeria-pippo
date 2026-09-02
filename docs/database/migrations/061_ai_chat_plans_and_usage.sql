-- ============================================================
-- 061_ai_chat_plans_and_usage.sql
-- Feature: chat-ia orchestrator — see
-- docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md (Phase 0.3).
--
-- Chat IA plan catalog (manageable by the superadmin from
-- /ai-chat-plans, not hardcoded) + daily usage tracking (messages +
-- tokens) per business. `limits` is JSON so new limit types can be
-- added in the future (e.g. "allowed models", see ai_models) without another
-- migration. ai_chat_usage follows the same date-keyed pattern as
-- telegram_usage (025_telegram_ai_bot.sql): a new row per day, without
-- needing cron.
--
-- Ported (renumbered) from feature/chat-ia-agente-admin, where this change
-- was file 057 — in main those numbers were already taken by
-- mcp_api_keys/mcp_saas. The RLS/GRANT/policies checklist that the
-- original didn't have is added here.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_chat_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  limits     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_chat_plans (name, limits, is_default) VALUES
  ('Básico', '{"messages_per_day": 20}'::jsonb, true),
  ('Pro', '{"messages_per_day": 100}'::jsonb, false),
  ('Ilimitado', '{"messages_per_day": null}'::jsonb, false);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS ai_chat_plan_id UUID REFERENCES public.ai_chat_plans(id);

UPDATE public.businesses
  SET ai_chat_plan_id = (SELECT id FROM public.ai_chat_plans WHERE is_default LIMIT 1)
  WHERE ai_chat_plan_id IS NULL;

ALTER TABLE public.businesses
  ALTER COLUMN ai_chat_plan_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES public.businesses(id),
  date           DATE NOT NULL,
  message_count  INTEGER NOT NULL DEFAULT 0,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, date)
);
CREATE INDEX IF NOT EXISTS ai_chat_usage_business_id_idx ON public.ai_chat_usage(business_id);

-- RLS + GRANT + policies — mandatory checklist from docs/database/README.md.
-- ai_chat_plans: platform catalog (no business_id) — read access for
-- any authenticated user (like ai_models/ai_prompts), write access reserved for the
-- superadmin.
ALTER TABLE public.ai_chat_plans ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.ai_chat_plans TO authenticated;
GRANT ALL ON TABLE public.ai_chat_plans TO service_role;

CREATE POLICY "authenticated_select_ai_chat_plans"
  ON public.ai_chat_plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "superadmin_insert_ai_chat_plans"
  ON public.ai_chat_plans FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'superadmin');

CREATE POLICY "superadmin_update_ai_chat_plans"
  ON public.ai_chat_plans FOR UPDATE TO authenticated
  USING (get_user_role() = 'superadmin');

-- ai_chat_usage: per business — same criteria as mcp_api_keys (admin role;
-- filtering by the specific business_id is done by the service layer).
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.ai_chat_usage TO authenticated;
GRANT ALL ON TABLE public.ai_chat_usage TO service_role;

CREATE POLICY "admin_select_ai_chat_usage"
  ON public.ai_chat_usage FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'superadmin'));

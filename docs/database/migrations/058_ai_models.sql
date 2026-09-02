-- ============================================================
-- 058_ai_models.sql
-- Feature: chat-ia orchestrator (services/ai-orchestrator) — see
-- docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md.
--
-- GLOBAL catalog of available AI models, manageable by the
-- superadmin (not hardcoded in the frontend or in the Spring
-- service). The orchestrator service asks NestJS which model to
-- use and resolves it from here. At this phase there's no gating by
-- plan yet: the model marked `is_default` is used. Gating
-- by plan (limits.allowed_models) arrives in a later phase.
--
-- Doesn't store API keys: cloud credentials are centralized and
-- live in the service's config (env/secret), not in the DB.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT NOT NULL,               -- 'ollama' | 'anthropic' | 'openai_compatible'
  model_id    TEXT NOT NULL,               -- real id passed to the provider (e.g. 'qwen3:8b')
  label       TEXT NOT NULL,               -- display name
  base_url    TEXT,                         -- for local/openai-compatible (null on Anthropic)
  is_local    BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one default model at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ai_models_single_default_idx
  ON public.ai_models (is_default) WHERE is_default = true;

-- Seed: default local model (Qwen 3 8B via Ollama).
INSERT INTO public.ai_models (provider, model_id, label, base_url, is_local, is_active, is_default)
VALUES ('ollama', 'qwen3:8b', 'Qwen 3 8B (local)', 'http://localhost:11434', true, true, true);

-- RLS + GRANT + policies — mandatory checklist from docs/database/README.md.
-- Platform catalog (no business_id): read access for any authenticated
-- user (no sensitive data here), write access via backend
-- (service_role). Management from the superadmin panel gets refined in the
-- "models per plan" phase.
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.ai_models TO authenticated;
GRANT ALL ON TABLE public.ai_models TO service_role;

CREATE POLICY "authenticated_select_ai_models"
  ON public.ai_models FOR SELECT TO authenticated
  USING (true);

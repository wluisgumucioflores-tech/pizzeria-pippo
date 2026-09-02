-- ============================================================
-- 062_ai_chat_plans_model_id.sql
-- Feature: chat-ia orchestrator — Phase 1 of the plan
-- (docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md).
--
-- No schema change: ai_chat_plans.limits is already jsonb. This
-- migration only documents the new `model_id` key (ai_models.id)
-- that the superadmin sets per plan, and backfills the plans already
-- seeded (061) with the model currently marked is_default,
-- so as not to break the current behavior of any business.
--
-- No model selector in the business panel (product decision,
-- Phase 1): the model is determined by the plan, not by the business.
-- ============================================================

UPDATE public.ai_chat_plans
SET limits = limits || jsonb_build_object(
  'model_id',
  (SELECT id::text FROM public.ai_models WHERE is_default = true LIMIT 1)
)
WHERE NOT (limits ? 'model_id');

-- ============================================================
-- 064_business_ai_chat_plan_nullable.sql
-- Feature: chat-ia orchestrator — Phase 10 follow-up
-- (docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md).
--
-- businesses.ai_chat_plan_id was a mandatory FK, forcing every business
-- to have an aiChat plan assigned even though aiChat is an opt-in
-- feature flag (enabledModules.aiChat). This forced businesses.service.ts
-- to auto-assign whichever plan had is_default = true at creation time —
-- which is also what let the duplicate-seed plans (061 run twice) leak
-- into real business data. A business that never enables aiChat doesn't
-- need a plan at all.
--
-- The FK constraint itself is untouched — a non-null value still has to
-- point to a real ai_chat_plans row, only NULL is now allowed.
-- ============================================================

ALTER TABLE public.businesses ALTER COLUMN ai_chat_plan_id DROP NOT NULL;

-- ============================================================
-- 060_business_enabled_modules_ai_chat.sql
-- Feature: chat-ia orchestrator — see
-- docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md (Phase 0.4).
--
-- Adds the "aiChat" module (AI chat assistant for the admin panel) to the
-- per-business feature flags set. Disabled by default (opt-in), same
-- as telegram and mesero. Enabled by the superadmin from the
-- businesses panel.
--
-- Ported (renumbered) from feature/chat-ia-agente-admin, where this change
-- was file 056 — in main those numbers were already taken by
-- mcp_api_keys/mcp_saas.
-- ============================================================

ALTER TABLE businesses
  ALTER COLUMN enabled_modules SET DEFAULT
  '{"kitchen":true,"stock":true,"employees":true,"telegram":false,"printer":true,"mesero":false,"mcpSaas":false,"aiChat":false}'::jsonb;

UPDATE businesses
  SET enabled_modules = enabled_modules || '{"aiChat":false}'::jsonb
  WHERE NOT (enabled_modules ? 'aiChat');

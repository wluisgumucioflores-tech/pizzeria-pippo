-- ============================================================
-- 063_ai_models_api_key.sql
-- Feature: chat-ia orchestrator — Phase 8 of the plan
-- (docs/features/chat-ia-backend/plan-desarrollo-spring-ai.md).
--
-- Adds api_key to ai_models to support cloud providers
-- (Anthropic, OpenAI-compatible). Product decision: the key
-- lives in this table, editable from the superadmin panel
-- (/ai-models) without redeploy — replaces migration 058's
-- original idea of keeping it only in the service's env/secret.
--
-- The value is stored ENCRYPTED (AES-256-GCM, backend/src/common/
-- utils/secret-crypto.ts), never in plain text — the encryption
-- key lives in AI_MODELS_ENCRYPTION_KEY (backend env, not
-- in the DB). The backend never returns this field to the superadmin
-- via API (list/get only expose has_api_key: boolean); it's only
-- decrypted server-to-server, when resolving runtime-config for
-- the Spring service.
-- ============================================================

ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS api_key TEXT;

COMMENT ON COLUMN public.ai_models.api_key IS
  'Encrypted (AES-256-GCM). Never exposed in plain text via API — see AI_MODELS_ENCRYPTION_KEY.';

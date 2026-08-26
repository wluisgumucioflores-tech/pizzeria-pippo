-- ============================================================
-- 057_business_enabled_modules_mcp_saas.sql
-- Feature: servidor MCP genérico (services/mcp-saas) — ver
-- docs/features/mcp-saas/feature.md.
--
-- Nuevo módulo opcional: mcpSaas — habilita la pestaña "MCP" en
-- Settings (self-serve de API key para el servidor MCP externo)
-- para el negocio. Por defecto deshabilitado (opt-in), igual que
-- telegram y mesero. Lo habilita el superadmin desde el panel de
-- negocios.
-- ============================================================

ALTER TABLE businesses
  ALTER COLUMN enabled_modules SET DEFAULT
  '{"kitchen":true,"stock":true,"employees":true,"telegram":false,"printer":true,"mesero":false,"mcpSaas":false}'::jsonb;

UPDATE businesses
  SET enabled_modules = enabled_modules || '{"mcpSaas":false}'::jsonb
  WHERE NOT (enabled_modules ? 'mcpSaas');

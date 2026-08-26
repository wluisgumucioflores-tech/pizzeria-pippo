-- ============================================================
-- 056_mcp_api_keys.sql
-- Feature: servidor MCP genérico (services/mcp-saas) — ver
-- docs/features/mcp-saas/feature.md.
--
-- Tabla de API keys para que un cliente MCP externo (Claude u
-- otra app) se autentique contra el backend de un negocio, sin
-- login de usuario. La key es a nivel negocio (no sucursal, a
-- diferencia de `devices`), generada self-serve por el admin
-- del negocio desde Settings. Solo se guarda el hash — igual
-- que `devices.api_key_hash`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id),
  name          TEXT NOT NULL,
  api_key_hash  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_api_keys_business_id_idx ON public.mcp_api_keys(business_id);

-- RLS + GRANT + policies — checklist obligatorio de docs/database/README.md
ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.mcp_api_keys TO authenticated;
GRANT ALL ON TABLE public.mcp_api_keys TO service_role;

CREATE POLICY "admin_select_mcp_api_keys"
  ON public.mcp_api_keys FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "admin_insert_mcp_api_keys"
  ON public.mcp_api_keys FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "admin_update_mcp_api_keys"
  ON public.mcp_api_keys FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "admin_delete_mcp_api_keys"
  ON public.mcp_api_keys FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

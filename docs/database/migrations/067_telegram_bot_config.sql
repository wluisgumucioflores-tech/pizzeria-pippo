-- ============================================================
-- 067_telegram_bot_config.sql
-- Feature: chat-ia por Telegram — ver
-- docs/features/chat-ia-backend/plan-integracion-telegram.md.
--
-- Config unificada de bot de Telegram por negocio: un solo bot/chat
-- registrado, con dos switches independientes (notifications_enabled ya
-- existía como `app_settings.telegram_enabled`; chat_ia_enabled es nuevo).
-- webhook_token/webhook_secret solo se completan cuando el negocio activa
-- chat_ia_enabled por primera vez (notificaciones nunca necesita webhook).
--
-- Backfill: copia los negocios que ya tenían notificaciones configuradas en
-- `app_settings` (telegram_bot_token/telegram_chat_id/telegram_enabled) a la
-- tabla nueva, con chat_ia_enabled = false (no cambia comportamiento
-- existente). Las keys viejas de app_settings NO se borran acá — se limpian
-- en una migración aparte una vez validado que todo lee de la tabla nueva
-- (ver Fase 5 del plan).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.telegram_bot_config (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id            UUID NOT NULL UNIQUE REFERENCES public.businesses(id),
  bot_token              TEXT NOT NULL,
  chat_id                TEXT NOT NULL,
  chat_type              TEXT NOT NULL DEFAULT 'group',
  notifications_enabled  BOOLEAN NOT NULL DEFAULT false,
  chat_ia_enabled        BOOLEAN NOT NULL DEFAULT false,
  webhook_token          TEXT UNIQUE,
  webhook_secret         TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_bot_config_business_id_idx ON public.telegram_bot_config(business_id);

-- Backfill desde app_settings (solo negocios con bot_token Y chat_id no vacíos,
-- mismo criterio que TelegramNotificationService.send() usa hoy para decidir
-- si manda el mensaje).
INSERT INTO public.telegram_bot_config (business_id, bot_token, chat_id, notifications_enabled, chat_ia_enabled)
SELECT
  business_id,
  MAX(value) FILTER (WHERE key = 'telegram_bot_token') AS bot_token,
  MAX(value) FILTER (WHERE key = 'telegram_chat_id') AS chat_id,
  COALESCE(MAX(value) FILTER (WHERE key = 'telegram_enabled') = 'true', false) AS notifications_enabled,
  false AS chat_ia_enabled
FROM public.app_settings
WHERE key IN ('telegram_bot_token', 'telegram_chat_id', 'telegram_enabled')
GROUP BY business_id
HAVING MAX(value) FILTER (WHERE key = 'telegram_bot_token') IS NOT NULL
   AND MAX(value) FILTER (WHERE key = 'telegram_bot_token') != ''
   AND MAX(value) FILTER (WHERE key = 'telegram_chat_id') IS NOT NULL
   AND MAX(value) FILTER (WHERE key = 'telegram_chat_id') != ''
ON CONFLICT (business_id) DO NOTHING;

-- RLS + GRANT + policies — checklist obligatorio de docs/database/README.md
ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.telegram_bot_config TO authenticated;
GRANT ALL ON TABLE public.telegram_bot_config TO service_role;

CREATE POLICY "admin_select_telegram_bot_config"
  ON public.telegram_bot_config FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "admin_insert_telegram_bot_config"
  ON public.telegram_bot_config FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "admin_update_telegram_bot_config"
  ON public.telegram_bot_config FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

CREATE POLICY "admin_delete_telegram_bot_config"
  ON public.telegram_bot_config FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

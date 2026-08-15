-- ============================================================
-- 052_kitchen_stage_colors.sql
-- Agrega el umbral intermedio (ámbar) y los colores configurables
-- de las 3 etapas de la pantalla de cocina:
--   verde (fresco) -> ambar (aviso) -> rojo (demorado)
--
-- `kitchen_late_threshold_minutes` ya existía (migración 027) y pasa
-- a marcar el corte ambar->rojo. Este archivo solo agrega el corte
-- verde->ambar (`kitchen_stage_warning_minutes`) y los 3 colores.
--
-- Los defaults también están hardcodeados en el backend
-- (SettingsService.getSettings), así que estos INSERT son solo para
-- que la fila exista explícitamente en `app_settings`; si se omiten,
-- la app igual funciona con los defaults del código.
-- ============================================================

INSERT INTO public.app_settings (business_id, key, value, updated_at)
SELECT id, 'kitchen_stage_warning_minutes', '7', now()
FROM public.businesses
ON CONFLICT (business_id, key) DO NOTHING;

INSERT INTO public.app_settings (business_id, key, value, updated_at)
SELECT id, 'kitchen_color_fresh', '#16a34a', now()
FROM public.businesses
ON CONFLICT (business_id, key) DO NOTHING;

INSERT INTO public.app_settings (business_id, key, value, updated_at)
SELECT id, 'kitchen_color_warning', '#d97706', now()
FROM public.businesses
ON CONFLICT (business_id, key) DO NOTHING;

INSERT INTO public.app_settings (business_id, key, value, updated_at)
SELECT id, 'kitchen_color_late', '#dc2626', now()
FROM public.businesses
ON CONFLICT (business_id, key) DO NOTHING;

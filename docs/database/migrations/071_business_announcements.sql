-- ============================================================
-- 071_business_announcements.sql
--
-- Announcement banner controlled by the superadmin: the superadmin
-- writes a message and assigns it to ONE business at a time (see
-- docs/features/superadmin-banner/). Shown in the admin panel and in
-- that business's POS, with an option to dismiss it (reappears on
-- every login — frontend-side logic, not this table's).
--
-- One record per business (business_id UNIQUE) — no history is kept:
-- creating a new banner for a business that already had one replaces
-- the previous message.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS + GRANT + policies — mandatory checklist from docs/database/README.md.
-- Note: the NestJS backend connects with a role that bypasses RLS, so
-- this doesn't restrict access via the API (that's done by
-- @Roles('superadmin') in AnnouncementsController) — it's just project
-- convention for direct Supabase access.
ALTER TABLE public.business_announcements ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.business_announcements TO authenticated;
GRANT ALL ON TABLE public.business_announcements TO service_role;

CREATE POLICY "superadmin_select_business_announcements"
  ON public.business_announcements FOR SELECT TO authenticated
  USING (get_user_role() = 'superadmin');
CREATE POLICY "superadmin_insert_business_announcements"
  ON public.business_announcements FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'superadmin');
CREATE POLICY "superadmin_update_business_announcements"
  ON public.business_announcements FOR UPDATE TO authenticated
  USING (get_user_role() = 'superadmin');
CREATE POLICY "superadmin_delete_business_announcements"
  ON public.business_announcements FOR DELETE TO authenticated
  USING (get_user_role() = 'superadmin');

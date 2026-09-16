import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { Announcement, UpsertAnnouncementInput } from "../types/announcement.types";

export const AnnouncementsService = {
  async getAnnouncements(): Promise<Announcement[]> {
    const res = await nestFetch(API_ENDPOINTS.announcements.base);
    if (!res.ok) return [];
    return res.json();
  },

  async upsertAnnouncement(businessId: string, values: UpsertAnnouncementInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.announcements.byBusinessId(businessId), {
      method: "PUT",
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async deleteAnnouncement(businessId: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.announcements.byBusinessId(businessId), { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },
};

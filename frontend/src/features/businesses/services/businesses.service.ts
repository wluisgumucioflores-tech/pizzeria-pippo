import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { Business, CreateBusinessInput, UpdateBusinessInput } from "../types/business.types";

export const BusinessesService = {
  async getBusinesses(): Promise<Business[]> {
    const res = await nestFetch(API_ENDPOINTS.businesses.base);
    if (!res.ok) return [];
    return res.json();
  },

  async createBusiness(values: CreateBusinessInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.businesses.base, { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async toggleActive(id: string, is_active: boolean): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.businesses.byId(id), { method: "PATCH", body: JSON.stringify({ is_active }) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async updateBusiness(id: string, values: UpdateBusinessInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.businesses.byId(id), { method: "PATCH", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },
};

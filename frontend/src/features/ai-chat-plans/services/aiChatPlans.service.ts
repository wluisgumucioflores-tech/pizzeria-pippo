import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { AiChatPlan, CreateAiChatPlanInput, UpdateAiChatPlanInput } from "../types/aiChatPlan.types";

export const AiChatPlansService = {
  async getPlans(includeInactive = false): Promise<AiChatPlan[]> {
    const res = await nestFetch(API_ENDPOINTS.aiChatPlans.list(includeInactive));
    if (!res.ok) return [];
    return res.json();
  },

  async createPlan(values: CreateAiChatPlanInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.aiChatPlans.base, { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async updatePlan(id: string, values: UpdateAiChatPlanInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.aiChatPlans.byId(id), { method: "PATCH", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },
};

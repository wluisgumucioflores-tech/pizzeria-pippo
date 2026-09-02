import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { AiModel, CreateAiModelInput, UpdateAiModelInput } from "../types/aiModel.types";

export const AiModelsService = {
  async getModels(includeInactive = false): Promise<AiModel[]> {
    const res = await nestFetch(API_ENDPOINTS.aiModels.list(includeInactive));
    if (!res.ok) return [];
    return res.json();
  },

  async createModel(values: CreateAiModelInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.aiModels.base, { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async updateModel(id: string, values: UpdateAiModelInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.aiModels.byId(id), { method: "PATCH", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },
};

import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { McpKey, CreateMcpKeyResult } from "../types/mcp-key.types";

export const McpKeysService = {
  async getKeys(): Promise<McpKey[]> {
    const res = await nestFetch(API_ENDPOINTS.mcp.keys.base);
    if (!res.ok) return [];
    return res.json();
  },

  async createKey(values: { name: string }): Promise<{ ok: boolean; result?: CreateMcpKeyResult; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.mcp.keys.base, { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error };
    }
    return { ok: true, result: await res.json() };
  },

  async updateKey(id: string, values: { name?: string; is_active?: boolean }): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.mcp.keys.byId(id), { method: "PATCH", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error };
    }
    return { ok: true };
  },
};

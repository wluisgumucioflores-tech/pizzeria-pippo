import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { Category, CategoryInput } from "../types/category.types";

export const CategoriesService = {
  async getCategories(): Promise<Category[]> {
    const res = await nestFetch(API_ENDPOINTS.categories.base);
    if (!res.ok) return [];
    return res.json();
  },

  async createCategory(values: CategoryInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.categories.base, { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async updateCategory(id: string, values: CategoryInput): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.categories.byId(id), { method: "PUT", body: JSON.stringify(values) });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },

  async deleteCategory(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.categories.byId(id), { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? data.message };
    }
    return { ok: true };
  },
};

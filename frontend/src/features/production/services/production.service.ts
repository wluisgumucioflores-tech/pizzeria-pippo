import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { BranchesService } from "@/features/branches/services/branches.service";
import type {
  VariantOption,
  IngredientUsageLog,
  OutputLog,
  ProductionLogListParams,
  ProductionLogListResult,
  Branch,
  WarehouseStockOption,
} from "../types/production.types";

type ServiceResult = { ok: boolean; error?: string };

async function asResult(res: Response): Promise<ServiceResult> {
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? data.message };
}

function buildListQs(params: ProductionLogListParams): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return qs.toString();
}

export const ProductionService = {
  // Only "made" products — the jefe de producción logs what's produced
  // in-house, not resale products bought ready-made.
  async getVariants(): Promise<VariantOption[]> {
    const res = await nestFetch(API_ENDPOINTS.products.allVariantsByType("made"));
    if (!res.ok) return [];
    return res.json();
  },

  async logIngredientUsage(payload: { ingredient_id: string; quantity: number }): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.ingredientUsage, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return asResult(res);
  },

  async updateIngredientUsage(
    id: string,
    payload: { ingredient_id: string; quantity: number },
  ): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.ingredientUsageById(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return asResult(res);
  },

  async deleteIngredientUsage(id: string): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.ingredientUsageById(id), { method: "DELETE" });
    return asResult(res);
  },

  async logOutput(payload: { variant_id: string; quantity: number }): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.output, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return asResult(res);
  },

  async updateOutput(id: string, payload: { variant_id: string; quantity: number }): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.outputById(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return asResult(res);
  },

  async deleteOutput(id: string): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.production.outputById(id), { method: "DELETE" });
    return asResult(res);
  },

  async getIngredientUsageLogs(params: ProductionLogListParams = {}): Promise<ProductionLogListResult<IngredientUsageLog>> {
    const res = await nestFetch(API_ENDPOINTS.production.ingredientUsageList(buildListQs(params)));
    if (!res.ok) return { data: [], total: 0 };
    const data = await res.json();
    return { data: data.data ?? [], total: data.total ?? 0 };
  },

  async getOutputLogs(params: ProductionLogListParams = {}): Promise<ProductionLogListResult<OutputLog>> {
    const res = await nestFetch(API_ENDPOINTS.production.outputList(buildListQs(params)));
    if (!res.ok) return { data: [], total: 0 };
    const data = await res.json();
    return { data: data.data ?? [], total: data.total ?? 0 };
  },

  // Fase 10 (warehouse→branch transfer): the jefe de producción needs to see
  // every branch of the business to pick a destination, even though they
  // have no branch of their own — backend adjusted to treat them like admin
  // in this listing (see branches.service.ts).
  async getBranches(): Promise<Branch[]> {
    return BranchesService.getBranches();
  },

  // Only "made" product balances — the only thing the jefe de producción can
  // have logged and transferred.
  async getWarehouseStock(): Promise<WarehouseStockOption[]> {
    const res = await nestFetch(API_ENDPOINTS.warehouse.productStockByType("made"));
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  },

  async transferToBranch(payload: { variant_id: string; branch_id: string; quantity: number }): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.warehouse.productTransfer, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return asResult(res);
  },
};

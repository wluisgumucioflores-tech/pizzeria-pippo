import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { ok, fail, type ServiceResult } from "@/lib/errors";
import { IngredientsService } from "@/features/ingredients/services/ingredients.service";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { ProductVariant } from "@pippo/shared";
import type { Product, Ingredient, Branch, Variant, Step1Data, VariantWithPrices } from "../types/product.types";

// Used only by uploadImage() below, which needs a raw fetch (FormData body,
// no Content-Type) instead of the shared nestFetch.
const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL;

interface ListProductsParams {
  showInactive?: boolean;
  page?: number;
  pageSize?: number;
  search?: string;
  category_id?: string | null;
}

interface ListProductsResult {
  data: Product[];
  total: number;
}

export const ProductsService = {
  async getProducts(params: ListProductsParams = {}): Promise<ListProductsResult> {
    const { showInactive = false, page = 1, pageSize = 10, search, category_id } = params;

    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (showInactive) qs.set("showInactive", "true");
    if (search) qs.set("search", search);
    if (category_id) qs.set("category_id", category_id);
    const res = await nestFetch(API_ENDPOINTS.products.list(qs.toString()));
    if (!res.ok) return { data: [], total: 0 };
    return res.json();
  },

  async getIngredients(): Promise<Ingredient[]> {
    const { data } = await IngredientsService.getIngredients({ pageSize: 9999 });
    return data;
  },

  async getBranches(): Promise<Branch[]> {
    return BranchesService.getBranches();
  },

  async getProductName(id: string): Promise<string | null> {
    const product = await ProductsService.getProductDetail(id);
    return product?.name ?? null;
  },

  // Rich shape (with denormalized branches/ingredients) — used by the detail view;
  // the edit view only takes the basic subset (Product) via `as`.
  async getProductDetail(id: string) {
    const res = await nestFetch(API_ENDPOINTS.products.byId(id));
    if (!res.ok) return null;
    return res.json();
  },

  async getVariantsWithDetails(productId: string): Promise<ProductVariant[]> {
    const res = await nestFetch(API_ENDPOINTS.products.variants(productId));
    if (!res.ok) return [];
    return res.json();
  },

  async createProduct(payload: unknown): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.products.base, { method: "POST", body: JSON.stringify(payload) });
    if (res.ok) return ok(undefined);
    const data = await res.json().catch(() => ({}));
    return fail(data.error ?? "Error al crear el producto");
  },

  async updateProduct(id: string, payload: unknown): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.products.byId(id), { method: "PUT", body: JSON.stringify(payload) });
    if (res.ok) return ok(undefined);
    const data = await res.json().catch(() => ({}));
    return fail(data.error ?? "Error al actualizar el producto");
  },

  async patchProduct(id: string, payload: unknown): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.products.byId(id), { method: "PATCH", body: JSON.stringify(payload) });
    if (res.ok) return { ok: true };
    const { error } = await res.json();
    return { ok: false, error };
  },

  async deleteProduct(id: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.products.byId(id), { method: "DELETE" });
    if (res.ok) return { ok: true };
    const { error } = await res.json();
    return { ok: false, error };
  },

  async duplicateProduct(id: string): Promise<{ ok: boolean; id?: string; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.products.duplicate(id), { method: "POST" });
    if (res.ok) {
      const { id: newId } = await res.json();
      return { ok: true, id: newId };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Error al duplicar el producto" };
  },

  async getBranchPrices(productId: string): Promise<{ variants: VariantWithPrices[]; branches: Branch[] }> {
    const res = await nestFetch(API_ENDPOINTS.products.branchPrices(productId));
    if (!res.ok) return { variants: [], branches: [] };
    return res.json();
  },

  async saveBranchPrice(productId: string, variantId: string, branchId: string, price: number): Promise<ServiceResult> {
    const res = await nestFetch(API_ENDPOINTS.products.branchPrices(productId), {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, branch_id: branchId, price }),
    });
    if (res.ok) return ok(undefined);
    const data = await res.json().catch(() => ({}));
    return fail(data.error ?? "Error al guardar");
  },

  async uploadImage(file: File, token: string): Promise<{ url?: string; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);
    // No Content-Type header here on purpose — the browser sets multipart/form-data
    // with the correct boundary itself when the body is a FormData instance.
    const res = await fetch(`${NEST_API_URL}${API_ENDPOINTS.storage.upload}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const { url: imageUrl } = await res.json();
      return { url: imageUrl };
    }
    const { error } = await res.json();
    return { error };
  },

  buildPayload(step1Data: Step1Data, imageUrl: string, variants: Variant[]) {
    const cleanVariants = variants
      .filter((v) => v.is_active !== false)
      .map((v) => ({
        ...v,
        recipes: v.recipes
          .filter((r) => r.ingredient_id && r.quantity > 0)
          .map(({ ingredient_id, quantity, apply_condition }) => ({ ingredient_id, quantity, apply_condition })),
      }));
    return {
      name: step1Data.name,
      category_id: step1Data.category_id,
      description: step1Data.description,
      image_url: imageUrl,
      product_type: step1Data.product_type,
      variants: cleanVariants,
    };
  },
};

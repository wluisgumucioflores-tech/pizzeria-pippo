import { ProductsService } from "@/features/products/services/products.service";
import type { DisplayProduct } from "../types/display.types";

export const DisplayService = {
  async getMenuProducts(): Promise<DisplayProduct[]> {
    const { data } = await ProductsService.getProducts({ pageSize: 9999 });
    // The endpoint only sorts by name (admin use); the customer display
    // needs to group by category, same as the old Supabase query.
    return (data as unknown as DisplayProduct[])
      .slice()
      .sort((a, b) => (a.category_id ?? "").localeCompare(b.category_id ?? "") || a.name.localeCompare(b.name));
  },
};

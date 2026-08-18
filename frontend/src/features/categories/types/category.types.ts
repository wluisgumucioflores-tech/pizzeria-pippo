export type { Category } from "@pippo/shared";

export interface CategoryInput {
  name: string;
  is_pizza?: boolean;
  sort_order?: number;
}

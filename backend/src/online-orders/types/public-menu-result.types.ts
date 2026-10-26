// Shape returned by GET /public/online-menu/:branchId.
//
// Deliberately NARROWER than the POS catalog (ProductsService.getPosCatalog):
// no recipes, no ingredients, no costs, no product_type, no branch_prices
// array — the resolved price only. This page is served to anyone with the
// link, so every field here is a field we chose to publish.

export interface PublicMenuVariant {
  id: string;
  name: string;
  /** Already resolved for this branch — the client never sees base vs override. */
  price: number;
}

export interface PublicMenuProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  variants: PublicMenuVariant[];
}

export interface PublicMenuResult {
  business_name: string;
  branch_id: string;
  branch_name: string;
  /** Empty when the business never configured one — hide the button. */
  whatsapp_configured: boolean;
  products: PublicMenuProduct[];
}

export interface MeseroExtra {
  name: string;
  price: number;
}

export interface MeseroCartItem {
  variant_id: string;
  qty: number;
  unit_price: number;
  product_name: string;
  variant_name: string;
  extras: MeseroExtra[];
}

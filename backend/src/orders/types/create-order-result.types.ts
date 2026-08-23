export interface CreateOrderResult {
  order_id: string;
  daily_number: number;
  duplicate: boolean;
  stock_updates?: { variant_id: string; quantity: number }[];
}

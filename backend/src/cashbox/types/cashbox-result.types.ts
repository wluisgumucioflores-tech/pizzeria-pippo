export interface CashExpenseResult {
  id: string;
  amount: number;
  category: string;
  note: string | null;
  created_at: Date;
  created_by_name: string | null;
}

export interface CashSessionResult {
  id: string;
  branch_id: string;
  opening_amount: number;
  opened_at: Date;
  opened_by_name: string | null;
  status: string;
  // Totales en vivo mientras la sesión está abierta; snapshot congelado una
  // vez cerrada (ver CashSession.expectedAmount en el schema).
  cash_sales: number;
  expenses_total: number;
  expected_amount: number;
  counted_amount: number | null;
  difference: number | null;
  closed_at: Date | null;
  closed_by_name: string | null;
  expenses: CashExpenseResult[];
}

export interface CashSessionListRow {
  id: string;
  opened_at: Date;
  branch_id: string;
  branch_name: string;
  cashier_name: string;
  opening_amount: number;
  cash_sales: number;
  expenses_total: number;
  counted_amount: number | null;
  difference: number | null;
  status: string;
}

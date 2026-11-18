export type CashExpenseCategory = "insumos" | "mantenimiento" | "transporte" | "otro";

export type CashSessionStatus = "open" | "closed" | "auto_closed";

export interface CashExpense {
  id: string;
  amount: number;
  category: CashExpenseCategory;
  note: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface CashSession {
  id: string;
  branch_id: string;
  opening_amount: number;
  opened_at: string;
  opened_by_name: string | null;
  status: CashSessionStatus;
  cash_sales: number;
  expenses_total: number;
  expected_amount: number;
  counted_amount: number | null;
  difference: number | null;
  closed_at: string | null;
  closed_by_name: string | null;
  expenses: CashExpense[];
}

export interface CashSessionListRow {
  id: string;
  opened_at: string;
  branch_id: string;
  branch_name: string;
  cashier_name: string;
  opening_amount: number;
  cash_sales: number;
  expenses_total: number;
  counted_amount: number | null;
  difference: number | null;
  status: CashSessionStatus;
}

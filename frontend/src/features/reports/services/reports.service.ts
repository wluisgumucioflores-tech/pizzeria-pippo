import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Branch, SalesSummary, TopProduct, DailyData, StockAlert, CashierReport, BranchElaboratedStock, Order, ProductionReport } from "../types/reports.types";

export const ReportsService = {
  async getBranches(): Promise<Branch[]> {
    return BranchesService.getBranches();
  },

  buildParams(selectedBranch: string, from: string, to: string): string {
    const params = new URLSearchParams();
    if (selectedBranch !== "all") params.set("branchId", selectedBranch);
    params.set("from", from);
    params.set("to", to);
    return params.toString();
  },

  async fetchSalesReports(params: string, selectedBranch: string): Promise<{
    summary: SalesSummary | null;
    topProducts: TopProduct[];
    dailyData: DailyData[];
    stockAlerts: StockAlert[];
  }> {
    const [salesRes, topRes, dailyRes, alertsRes] = await Promise.all([
      nestFetch(API_ENDPOINTS.reports.sales(params)),
      nestFetch(API_ENDPOINTS.reports.topProducts(params)),
      nestFetch(API_ENDPOINTS.reports.daily(params)),
      nestFetch(API_ENDPOINTS.stock.alerts(selectedBranch !== "all" ? selectedBranch : undefined)),
    ]);

    const [salesData, topData, dailyRaw, alertsData] = await Promise.all([
      salesRes.json(), topRes.json(), dailyRes.json(), alertsRes.json(),
    ]);

    return {
      summary: salesData && !salesData.error ? salesData : null,
      topProducts: Array.isArray(topData) ? topData : [],
      dailyData: Array.isArray(dailyRaw) ? dailyRaw : [],
      stockAlerts: Array.isArray(alertsData) ? alertsData : [],
    };
  },

  async fetchCashierReports(params: string): Promise<{ cashiers: CashierReport[]; branchStock: BranchElaboratedStock[] }> {
    const res = await nestFetch(API_ENDPOINTS.reports.cashiers(params));
    const data = await res.json();
    return {
      cashiers: Array.isArray(data?.cashiers) ? data.cashiers : [],
      branchStock: Array.isArray(data?.branch_stock) ? data.branch_stock : [],
    };
  },

  async fetchProductionReport(params: string): Promise<ProductionReport> {
    const res = await nestFetch(API_ENDPOINTS.reports.production(params));
    const data = await res.json();
    if (data && !data.error) return { ingredients: data.ingredients ?? [], outputs: data.outputs ?? [] };
    return { ingredients: [], outputs: [] };
  },

  async fetchOrders(params: string, page: number, pageSize: number): Promise<{ data: Order[]; total: number }> {
    const res = await nestFetch(API_ENDPOINTS.reports.orders(`${params}&page=${page}&pageSize=${pageSize}`));
    const data = await res.json();
    if (data && !data.error) return { data: data.data ?? [], total: data.total ?? 0 };
    return { data: [], total: 0 };
  },

  async cancelOrder(orderId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
    const res = await nestFetch(API_ENDPOINTS.orders.cancel(orderId), { method: "POST", body: JSON.stringify({ reason }) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Error al anular la orden" };
  },

  async fetchAllOrdersForExport(params: string): Promise<Order[]> {
    const res = await nestFetch(API_ENDPOINTS.reports.orders(`${params}&page=1&pageSize=9999`));
    const data = await res.json();
    if (data && !data.error) return data.data ?? [];
    return [];
  },
};

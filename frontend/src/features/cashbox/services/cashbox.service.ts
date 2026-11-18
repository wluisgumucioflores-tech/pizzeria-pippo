import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { CashExpenseCategory, CashSession, CashSessionListRow } from "../types/cashbox.types";

interface SessionActionResult {
  ok: boolean;
  session?: CashSession;
  error?: string;
}

export const CashboxService = {
  async getCurrentSession(branchId: string): Promise<CashSession | null> {
    const res = await nestFetch(API_ENDPOINTS.cashbox.current(branchId));
    if (!res.ok) return null;
    // Sin sesión abierta, el backend devuelve null — NestJS manda el body
    // vacío en ese caso (no el string "null"), y res.json() no parsea "".
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  async openSession(branchId: string, openingAmount: number): Promise<SessionActionResult> {
    const res = await nestFetch(API_ENDPOINTS.cashbox.open, {
      method: "POST",
      body: JSON.stringify({ branch_id: branchId, opening_amount: openingAmount }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, session: data };
  },

  async addExpense(
    sessionId: string,
    amount: number,
    category: CashExpenseCategory,
    note: string | undefined,
  ): Promise<SessionActionResult> {
    const res = await nestFetch(API_ENDPOINTS.cashbox.addExpense(sessionId), {
      method: "POST",
      body: JSON.stringify({ amount, category, note }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, session: data };
  },

  async closeSession(sessionId: string, countedAmount: number): Promise<SessionActionResult> {
    const res = await nestFetch(API_ENDPOINTS.cashbox.close(sessionId), {
      method: "POST",
      body: JSON.stringify({ counted_amount: countedAmount }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, session: data };
  },

  // `params` ya viene armado por ReportFilters.buildParams() (branchId/from/to).
  async listSessions(params: string): Promise<CashSessionListRow[]> {
    const res = await nestFetch(API_ENDPOINTS.cashbox.list(params));
    if (!res.ok) return [];
    return res.json();
  },
};

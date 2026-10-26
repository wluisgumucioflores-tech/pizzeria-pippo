import type { OnlineOrdersHistoryFilters } from "../types/manage.types";

export const HISTORY_PAGE_SIZE = 50;

/**
 * Builds the query string for the history endpoint.
 *
 * Pure and separate from the service so the filter-to-URL mapping is testable:
 * an empty filter has to produce NO parameter at all, not `status=`, which the
 * backend DTO would reject with a 400 (`@IsIn` fails on an empty string).
 *
 * Dates arrive as plain `YYYY-MM-DD` from the picker and are widened to cover
 * the whole local day — a bare date would make `to` mean midnight and silently
 * exclude everything ordered that day.
 */
export function buildHistoryQuery(
  filters: OnlineOrdersHistoryFilters,
  page: number,
  pageSize: number = HISTORY_PAGE_SIZE,
): string {
  const params = new URLSearchParams();

  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", startOfDayIso(filters.from));
  if (filters.to) params.set("to", endOfDayIso(filters.to));

  params.set("limit", String(pageSize));
  params.set("offset", String(Math.max(0, page - 1) * pageSize));

  return `?${params.toString()}`;
}

function startOfDayIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}

function endOfDayIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}

/**
 * Builds the ESC/POS byte stream for a sale ticket.
 * Layout mirrors the on-screen TicketModal.
 */
import type { TicketData } from "@/features/pos/types/pos.types";
import type { DiscountedItem } from "@/lib/promotions";
import { formatDateTimeBolivia } from "@/lib/timezone";
import {
  CHARS_PER_LINE,
  ORDER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  DEFAULT_TICKET_BUSINESS_NAME,
  TICKET_FOOTER_MESSAGE,
} from "../constants/printing.constants";
import type { TicketPrintConfig } from "../types/printing.types";
import {
  CMD,
  concatBytes,
  divider,
  encodeLine,
  feed,
  formatRow,
} from "./escpos.service";

function itemLabel(item: DiscountedItem): string {
  const base = `${item.qty_physical}x ${item.product_name}`;
  if (item.flavors?.length) {
    return `${base} - Mit. ${item.flavors[0].product_name} / Mit. ${item.flavors[1].product_name}`;
  }
  return `${base} (${item.variant_name})`;
}

function itemPrice(item: DiscountedItem): string {
  return `Bs ${(item.unit_price * item.qty_physical - item.discount_applied).toFixed(2)}`;
}

export function buildTicketBytes(
  ticket: TicketData,
  config: TicketPrintConfig,
  printedAt: Date = new Date()
): Uint8Array {
  const width = CHARS_PER_LINE[config.paperWidth];
  const parts: Uint8Array[] = [CMD.INIT];

  // Header
  parts.push(
    CMD.ALIGN_CENTER,
    CMD.BOLD_ON,
    encodeLine(config.businessName?.trim() || DEFAULT_TICKET_BUSINESS_NAME),
    CMD.BOLD_OFF
  );
  if (config.branchName) parts.push(encodeLine(config.branchName));
  parts.push(encodeLine(formatDateTimeBolivia(printedAt)));

  // Daily order number
  parts.push(encodeLine(divider(width)));
  parts.push(
    CMD.SIZE_DOUBLE,
    encodeLine(`#${String(ticket.dailyNumber).padStart(2, "0")}`),
    CMD.SIZE_NORMAL
  );
  parts.push(encodeLine(ORDER_TYPE_LABELS[ticket.orderType] ?? ""));
  if (ticket.tableNumber) parts.push(encodeLine(`Mesa: ${ticket.tableNumber}`));
  if (ticket.waiterName) parts.push(encodeLine(`Mesero: ${ticket.waiterName}`));
  parts.push(CMD.ALIGN_LEFT, encodeLine(divider(width)));

  // Items
  for (const item of ticket.items) {
    for (const line of formatRow(itemLabel(item), itemPrice(item), width)) {
      parts.push(encodeLine(line));
    }
    if (item.promo_label) parts.push(encodeLine(`  PROMO: ${item.promo_label}`));
  }
  parts.push(encodeLine(divider(width)));

  // Totals
  parts.push(CMD.BOLD_ON);
  for (const line of formatRow("TOTAL", `Bs ${ticket.total.toFixed(2)}`, width)) {
    parts.push(encodeLine(line));
  }
  parts.push(CMD.BOLD_OFF);
  const payment =
    ticket.paymentMethod === "mixto" && ticket.payments?.length
      ? ticket.payments.map((p) => `${PAYMENT_METHOD_LABELS[p.method] ?? p.method} Bs ${p.amount.toFixed(2)}`).join(" + ")
      : ticket.paymentMethod
        ? PAYMENT_METHOD_LABELS[ticket.paymentMethod] ?? ticket.paymentMethod
        : "-";
  parts.push(encodeLine(`Pago: ${payment}`));

  if (ticket.notes) {
    parts.push(encodeLine(divider(width)));
    parts.push(encodeLine("Nota:"));
    parts.push(encodeLine(ticket.notes));
  }

  // Footer
  parts.push(
    CMD.ALIGN_CENTER,
    encodeLine(""),
    encodeLine(TICKET_FOOTER_MESSAGE),
    feed(3),
    CMD.CUT
  );

  return concatBytes(parts);
}

// Pure helpers for the public QR ordering flow (see
// docs/features/pedidos-online-qr/). No Nest, no Prisma, no clock of their
// own — every function takes what it needs, so all of this is directly
// testable and shared between the public endpoints (Fase 2) and the
// management ones (Fase 3).

export interface PricedLine {
  productName: string;
  variantName: string;
  qty: number;
  unitPrice: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeLineTotal(line: PricedLine): number {
  return round2(line.unitPrice * line.qty);
}

export function computeOrderTotal(lines: PricedLine[]): number {
  return round2(lines.reduce((sum, line) => sum + computeLineTotal(line), 0));
}

export function expiresAtFrom(createdAt: Date, expireMinutes: number): Date {
  return new Date(createdAt.getTime() + expireMinutes * 60_000);
}

// A request is only actionable while it's still pending AND inside its
// window. Used both to filter listings and to reject a confirmation that
// arrives a second too late, so both paths can never disagree.
export function isActionable(
  order: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return (
    order.status === 'pending' && order.expiresAt.getTime() > now.getTime()
  );
}

export function isExpired(
  order: { status: string; expiresAt: Date },
  now: Date,
): boolean {
  return (
    order.status === 'pending' && order.expiresAt.getTime() <= now.getTime()
  );
}

// wa.me needs the number as digits only — no '+', no spaces, no dashes.
export function normalizeWhatsAppNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, '');
}

export interface OrderMessageInput {
  businessName: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  lines: PricedLine[];
  total: number;
  notes?: string | null;
  /** Shown so the cashier can match the WhatsApp text to the row on screen. */
  reference: string;
}

// The text the CUSTOMER sends from their own WhatsApp. It is a courtesy copy,
// never the channel the business relies on (they have to press send, and we
// can't know whether they did) — see feature.md.
//
// Spanish because it's user-facing content, same rule as any UI string.
export function buildOrderMessage(input: OrderMessageInput): string {
  const lines = input.lines.map(
    (line) =>
      `• ${line.qty}x ${line.productName} ${line.variantName} — ${formatAmount(
        computeLineTotal(line),
      )} Bs`,
  );

  const parts = [
    `*Nuevo pedido online* — ${input.businessName}`,
    `Sucursal: ${input.branchName}`,
    `Pedido: #${input.reference}`,
    '',
    ...lines,
    '',
    `*Total: ${formatAmount(input.total)} Bs*`,
    '',
    `Nombre: ${input.customerName}`,
    `Teléfono: ${input.customerPhone}`,
  ];

  if (input.notes?.trim()) {
    parts.push(`Nota: ${input.notes.trim()}`);
  }

  return parts.join('\n');
}

// Returns an empty string when the business never configured a number, so the
// public page can hide the WhatsApp button instead of opening a broken link.
export function buildWhatsAppLink(
  whatsappNumber: string,
  message: string,
): string {
  const digits = normalizeWhatsAppNumber(whatsappNumber);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

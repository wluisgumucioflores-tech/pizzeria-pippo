import type { PaperWidth } from "../types/printing.types";

export const DEFAULT_TICKET_BUSINESS_NAME = "GU PIZZA";
export const TICKET_FOOTER_MESSAGE = "¡Gracias por su compra!";

export const DEFAULT_PAPER_WIDTH: PaperWidth = 58;

export const CHARS_PER_LINE: Record<PaperWidth, number> = {
  58: 32,
  80: 48,
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  qr: "QR",
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Para comer aquí",
  takeaway: "Para llevar",
};

// GATT services exposed by common generic BLE thermal printers.
export const BLE_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

// BLE writes are limited by the negotiated MTU — tickets are sent in small chunks.
export const BLE_CHUNK_SIZE = 100;
export const BLE_CHUNK_DELAY_MS = 30;

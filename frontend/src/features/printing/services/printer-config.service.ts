import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { DEFAULT_PAPER_WIDTH, DEFAULT_TICKET_BUSINESS_NAME } from "../constants/printing.constants";
import type { PaperWidth } from "../types/printing.types";

export interface PrinterConfig {
  paperWidth: PaperWidth;
  businessName: string;
}

/** Reads the ticket settings. Falls back to defaults on any error. */
export async function getPrinterConfig(): Promise<PrinterConfig> {
  try {
    const res = await nestFetch(API_ENDPOINTS.settings.printer);
    if (!res.ok) return { paperWidth: DEFAULT_PAPER_WIDTH, businessName: DEFAULT_TICKET_BUSINESS_NAME };
    const data = await res.json();
    return {
      paperWidth: data.printer_paper_width === 80 ? 80 : 58,
      businessName: typeof data.printer_business_name === "string" && data.printer_business_name.trim()
        ? data.printer_business_name.trim()
        : DEFAULT_TICKET_BUSINESS_NAME,
    };
  } catch {
    return { paperWidth: DEFAULT_PAPER_WIDTH, businessName: DEFAULT_TICKET_BUSINESS_NAME };
  }
}

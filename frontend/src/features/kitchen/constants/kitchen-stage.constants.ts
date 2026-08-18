import type { KitchenStageSettings } from "../types/kitchen.types";

export const DEFAULT_STAGE_SETTINGS: KitchenStageSettings = {
  kitchen_stage_warning_minutes: 7,
  kitchen_late_threshold_minutes: 10,
  kitchen_color_fresh: "#16a34a",
  kitchen_color_warning: "#d97706",
  kitchen_color_late: "#dc2626",
  kitchen_visible_category_ids: [],
};

export type KitchenStage = "fresh" | "warning" | "late";

export function getKitchenStage(minutes: number, settings: KitchenStageSettings): KitchenStage {
  if (minutes >= settings.kitchen_late_threshold_minutes) return "late";
  if (minutes >= settings.kitchen_stage_warning_minutes) return "warning";
  return "fresh";
}

export function getStageColor(stage: KitchenStage, settings: KitchenStageSettings): string {
  if (stage === "late") return settings.kitchen_color_late;
  if (stage === "warning") return settings.kitchen_color_warning;
  return settings.kitchen_color_fresh;
}

// Admins can pick an arbitrary hex color, so badge text needs to stay
// readable against it instead of assuming white always works.
export function getReadableTextColor(hex: string): "#000000" | "#ffffff" {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}

import { describe, it, expect } from "vitest";
import { isExpired, minutesLeft } from "./expiry";

const NOW = new Date("2026-10-26T12:00:00Z").getTime();
const at = (minutesFromNow: number) =>
  new Date(NOW + minutesFromNow * 60_000).toISOString();

describe("minutesLeft", () => {
  it("devuelve los minutos restantes", () => {
    expect(minutesLeft(at(30), NOW)).toBe(30);
  });

  // Redondea para arriba: mostrar "0 min" con 40 segundos por delante se lee
  // como ya vencido y el cajero descartaría un pedido todavía válido.
  it("redondea hacia arriba los segundos sobrantes", () => {
    expect(minutesLeft(new Date(NOW + 40_000).toISOString(), NOW)).toBe(1);
    expect(minutesLeft(new Date(NOW + 61_000).toISOString(), NOW)).toBe(2);
  });

  it("piso en 0 para un pedido ya vencido, nunca negativo", () => {
    expect(minutesLeft(at(-10), NOW)).toBe(0);
    expect(minutesLeft(at(0), NOW)).toBe(0);
  });

  // Una fecha corrupta no debe pintar "NaN min" en el panel del cajero.
  it("devuelve 0 con una fecha inválida en vez de NaN", () => {
    expect(minutesLeft("no-es-fecha", NOW)).toBe(0);
  });
});

describe("isExpired", () => {
  it("true solo cuando el plazo ya pasó", () => {
    expect(isExpired(at(1), NOW)).toBe(false);
    expect(isExpired(at(-1), NOW)).toBe(true);
  });

  // El borde exacto cuenta como vencido, igual que isActionable en el backend.
  it("el instante exacto del vencimiento ya cuenta como vencido", () => {
    expect(isExpired(at(0), NOW)).toBe(true);
  });
});

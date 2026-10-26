import { describe, it, expect } from "vitest";
import { formatLineTotal, formatMoney } from "./money";

describe("formatMoney", () => {
  // El formato tiene que coincidir con el POS y el ticket impreso: el cliente
  // compara el precio del celular con lo que le cobra el cajero.
  it("usa el mismo formato que el POS", () => {
    expect(formatMoney(75)).toBe("Bs 75.00");
    expect(formatMoney(9.9)).toBe("Bs 9.90");
    expect(formatMoney(1500)).toBe("Bs 1500.00");
  });

  it("redondea a dos decimales", () => {
    expect(formatMoney(10.005)).toBe("Bs 10.01");
    expect(formatMoney(0)).toBe("Bs 0.00");
  });

  // Mostrarle "Bs NaN" a un cliente es peor que mostrar cero: el total real lo
  // calcula el servidor igual.
  it("no imprime NaN ni Infinity", () => {
    expect(formatMoney(Number.NaN)).toBe("Bs 0.00");
    expect(formatMoney(Number.POSITIVE_INFINITY)).toBe("Bs 0.00");
  });
});

describe("formatLineTotal", () => {
  it("multiplica y redondea como el carrito", () => {
    expect(formatLineTotal(9.9, 3)).toBe("Bs 29.70");
    expect(formatLineTotal(75, 2)).toBe("Bs 150.00");
  });
});

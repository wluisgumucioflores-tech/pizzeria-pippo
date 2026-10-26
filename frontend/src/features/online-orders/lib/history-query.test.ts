import { describe, it, expect } from "vitest";
import { buildHistoryQuery, HISTORY_PAGE_SIZE } from "./history-query";

describe("buildHistoryQuery", () => {
  // Un filtro vacío NO puede mandar `status=`: el DTO del backend valida con
  // @IsIn y una cadena vacía le da 400.
  it("no manda parámetros para los filtros vacíos", () => {
    const query = buildHistoryQuery({}, 1);

    expect(query).not.toContain("status=");
    expect(query).not.toContain("branchId=");
    expect(query).not.toContain("from=");
    expect(query).not.toContain("to=");
  });

  it("siempre manda limit y offset", () => {
    const params = new URLSearchParams(buildHistoryQuery({}, 1));

    expect(params.get("limit")).toBe(String(HISTORY_PAGE_SIZE));
    expect(params.get("offset")).toBe("0");
  });

  it("calcula el offset a partir de la página", () => {
    expect(new URLSearchParams(buildHistoryQuery({}, 3, 50)).get("offset")).toBe("100");
    expect(new URLSearchParams(buildHistoryQuery({}, 2, 10)).get("offset")).toBe("10");
  });

  // Una página 0 o negativa daría un offset negativo y el backend lo rechaza
  // (@Min(0)).
  it("no genera un offset negativo", () => {
    expect(new URLSearchParams(buildHistoryQuery({}, 0)).get("offset")).toBe("0");
    expect(new URLSearchParams(buildHistoryQuery({}, -5)).get("offset")).toBe("0");
  });

  it("pasa sucursal y estado cuando están", () => {
    const params = new URLSearchParams(
      buildHistoryQuery({ branchId: "br-1", status: "confirmed" }, 1),
    );

    expect(params.get("branchId")).toBe("br-1");
    expect(params.get("status")).toBe("confirmed");
  });

  // Lo importante del rango: `to` tiene que cubrir el día COMPLETO. Mandar la
  // fecha pelada haría que signifique medianoche y dejaría afuera todo lo que
  // se pidió ese día.
  it("expande el rango para cubrir los días enteros", () => {
    const params = new URLSearchParams(
      buildHistoryQuery({ from: "2026-10-01", to: "2026-10-31" }, 1),
    );

    const from = new Date(params.get("from") as string);
    const to = new Date(params.get("to") as string);

    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
    expect(to.getHours()).toBe(23);
    expect(to.getMinutes()).toBe(59);
  });

  it("acepta un rango de un solo lado", () => {
    const params = new URLSearchParams(buildHistoryQuery({ from: "2026-10-01" }, 1));

    expect(params.get("from")).not.toBeNull();
    expect(params.get("to")).toBeNull();
  });

  it("manda fechas en ISO, que es lo que valida el DTO", () => {
    const params = new URLSearchParams(buildHistoryQuery({ from: "2026-10-01" }, 1));

    expect(params.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

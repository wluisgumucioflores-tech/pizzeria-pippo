import { describe, it, expect } from "vitest";
import {
  buildOrderUrl,
  isUnreachableForCustomers,
  resolvePublicBaseUrl,
} from "./public-url";

describe("resolvePublicBaseUrl", () => {
  it("prefiere la variable de entorno sobre el origin del navegador", () => {
    expect(resolvePublicBaseUrl("https://pedidos.pippo.bo", "http://localhost:3000")).toBe(
      "https://pedidos.pippo.bo",
    );
  });

  it("cae al origin del navegador si no hay variable configurada", () => {
    expect(resolvePublicBaseUrl(undefined, "http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolvePublicBaseUrl("", "http://localhost:3000")).toBe("http://localhost:3000");
    expect(resolvePublicBaseUrl("   ", "http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("saca la barra final para no generar una URL con doble barra", () => {
    expect(resolvePublicBaseUrl("https://pedidos.pippo.bo/", "x")).toBe("https://pedidos.pippo.bo");
    expect(resolvePublicBaseUrl("https://pedidos.pippo.bo///", "x")).toBe("https://pedidos.pippo.bo");
  });
});

describe("buildOrderUrl", () => {
  // La ruta es /order (inglés, como el resto del código) — era /pedir y eso
  // rompía la convención del proyecto.
  it("arma la ruta /order con el id de la sucursal", () => {
    expect(buildOrderUrl("https://pedidos.pippo.bo", "br-1")).toBe(
      "https://pedidos.pippo.bo/order/br-1",
    );
  });

  it("tolera una base con barra final", () => {
    expect(buildOrderUrl("https://pedidos.pippo.bo/", "br-1")).toBe(
      "https://pedidos.pippo.bo/order/br-1",
    );
  });
});

describe("isUnreachableForCustomers", () => {
  // El riesgo concreto: imprimir 50 stickers con un QR que solo abre en la
  // PC del admin, y descubrirlo cuando ya están pegados en las mesas.
  it("marca localhost y loopback", () => {
    expect(isUnreachableForCustomers("http://localhost:3000")).toBe(true);
    expect(isUnreachableForCustomers("http://127.0.0.1:3000")).toBe(true);
  });

  it("marca las IP privadas de red local", () => {
    expect(isUnreachableForCustomers("http://192.168.100.100:3000")).toBe(true);
    expect(isUnreachableForCustomers("http://10.0.0.5:3000")).toBe(true);
    expect(isUnreachableForCustomers("http://172.16.0.1:3000")).toBe(true);
    expect(isUnreachableForCustomers("http://172.31.255.1:3000")).toBe(true);
  });

  it("marca los hostnames .local de mDNS", () => {
    expect(isUnreachableForCustomers("http://macbook.local:3000")).toBe(true);
  });

  // 172.32.x NO es privada (el rango privado termina en 172.31), así que una
  // regex floja de "todo 172." daría un falso positivo molesto.
  it("no marca una IP pública parecida a una privada", () => {
    expect(isUnreachableForCustomers("http://172.32.0.1")).toBe(false);
    expect(isUnreachableForCustomers("http://172.15.0.1")).toBe(false);
  });

  it("no marca un dominio público real", () => {
    expect(isUnreachableForCustomers("https://pedidos.pippo.bo")).toBe(false);
    expect(isUnreachableForCustomers("https://pippo.vercel.app")).toBe(false);
  });

  // Una base malformada no puede pasar como "alcanzable": si no se puede
  // parsear, tampoco se puede garantizar que funcione.
  it("falla cerrado con una base inválida", () => {
    expect(isUnreachableForCustomers("no-es-una-url")).toBe(true);
    expect(isUnreachableForCustomers("")).toBe(true);
  });
});

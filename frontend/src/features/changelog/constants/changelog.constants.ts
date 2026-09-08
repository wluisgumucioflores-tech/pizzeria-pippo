import type { ChangelogEntry } from "../types/changelog.types";

// Mantenido a mano — agregar una entrada nueva arriba de todo cada vez que
// se sube un cambio que valga la pena mostrarle al superadmin.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "2026-09-07",
    items: [
      "Botón de refrescar en el header del panel admin — recarga los datos de la página actual sin recargar todo el navegador.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-09-04",
    items: [
      "Chat IA disponible por Telegram: cada negocio puede registrar su propio bot para recibir notificaciones de pedidos y/o responder consultas por chat.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-03",
    items: [
      "Menú de usuario unificado (ícono con dropdown) en los headers de POS y Cocina, en vez de botones sueltos.",
      "Corregido: las promociones ya no se aplicaban por error a productos agregados desde la pestaña de Venta.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-08-31",
    items: [
      "Nuevo orquestador de chat IA con herramientas (tool-calling) para el widget de chat del panel admin.",
    ],
  },
];

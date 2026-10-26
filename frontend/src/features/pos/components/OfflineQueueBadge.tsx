"use client";

import { Tag, Tooltip } from "antd";
import type { SyncSnapshot } from "../services/offline-sync.service";

/** A queue stuck for longer than this turns the badge red. */
const STUCK_AFTER_MS = 60_000;

interface Props {
  snapshot: SyncSnapshot;
  servingCached: boolean;
  onSyncNow: () => void;
}

/**
 * Tells the cashier that sales are still only on this device. Deliberately
 * loud when the queue stops draining: until a sale syncs, losing the tablet
 * means losing the sale.
 */
export function OfflineQueueBadge({ snapshot, servingCached, onSyncNow }: Props) {
  const { pending, conflicts, oldestPendingAt } = snapshot;

  if (!pending && !conflicts && !servingCached) return null;

  const stuck =
    oldestPendingAt !== null && Date.now() - oldestPendingAt > STUCK_AFTER_MS;

  return (
    <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
      {pending > 0 && (
        <Tooltip
          title={
            stuck
              ? "Estas ventas todavía no llegaron al servidor. No apagues ni cierres la tablet. Tocá para reintentar."
              : "Sincronizando en segundo plano. Tocá para reintentar ahora."
          }
        >
          <Tag
            color={stuck ? "red" : "orange"}
            onClick={onSyncNow}
            style={{ margin: 0, cursor: "pointer" }}
            className={stuck ? "animate-pulse" : undefined}
          >
            {stuck ? "🔴" : "⏳"} {pending} sin sincronizar
          </Tag>
        </Tooltip>
      )}

      {conflicts > 0 && (
        <Tooltip title="El servidor rechazó estas ventas (cambió un precio o una promoción). Hay que revisarlas a mano.">
          <Tag color="volcano" style={{ margin: 0 }}>
            ⚠️ {conflicts} con error
          </Tag>
        </Tooltip>
      )}

      {servingCached && (
        <Tooltip title="No se pudo actualizar el catálogo. Estás viendo los últimos productos y precios guardados.">
          <Tag color="gold" style={{ margin: 0 }}>
            📦 Catálogo guardado
          </Tag>
        </Tooltip>
      )}
    </span>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  isBlockRunningLow,
  takeNumber,
  type NumberBlock,
} from "@/lib/offline-queue";
import { OfflineSalesService } from "../services/offline-sales.service";
import { OfflineSyncService, type SyncSnapshot } from "../services/offline-sync.service";

/** How often the drain loop wakes up to retry whatever is due. */
const DRAIN_INTERVAL_MS = 15_000;

const EMPTY: SyncSnapshot = { pending: 0, conflicts: 0, oldestPendingAt: null };

/**
 * Owns the offline sales queue for the POS: the reserved ticket-number block,
 * the background drain loop and the counters the header shows.
 *
 * `enabled` comes from the business's offlineSales module. When it is off this
 * hook does nothing at all — no IndexedDB, no timers, no reservations — so a
 * business without the flag runs exactly the code it ran before.
 */
export function useOfflineSales(branchId: string | undefined, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(EMPTY);
  const blockRef = useRef<NumberBlock | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(enabled ? await OfflineSyncService.snapshot() : EMPTY);
  }, [enabled]);

  // Keep a usable block at hand while the connection still works, so an
  // offline sale never has to ask the server for a number.
  const ensureBlock = useCallback(async () => {
    if (!enabled || !branchId) return;
    const stored = await OfflineSalesService.readBlock(branchId);
    blockRef.current = stored;
    if (!stored || isBlockRunningLow(stored)) {
      const fresh = await OfflineSalesService.reserveBlock(branchId);
      if (fresh) blockRef.current = fresh;
    }
  }, [branchId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(EMPTY);
      return;
    }
    void ensureBlock();
    void refreshSnapshot();
    void OfflineSyncService.drain();

    const unsubscribe = OfflineSyncService.subscribe(() => void refreshSnapshot());
    const interval = setInterval(() => void OfflineSyncService.drain(), DRAIN_INTERVAL_MS);
    // The browser coming back online is the strongest signal we get — drain
    // immediately instead of waiting out the interval.
    const onOnline = () => void OfflineSyncService.drain();
    window.addEventListener("online", onOnline);

    return () => {
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, ensureBlock, refreshSnapshot]);

  // Warn before the tab closes with sales that never reached the server — they
  // live only on this device until they sync.
  useEffect(() => {
    if (!enabled || snapshot.pending === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled, snapshot.pending]);

  /**
   * Reserves the next ticket number for a sale about to be queued. Returns null
   * when the range is spent and no new one could be reserved — the POS must
   * then fall back to selling online only.
   */
  const takeTicketNumber = useCallback(async (): Promise<number | null> => {
    if (!enabled || !branchId) return null;
    if (!blockRef.current) await ensureBlock();

    const taken = blockRef.current ? takeNumber(blockRef.current) : null;
    if (!taken) {
      await ensureBlock();
      const retry = blockRef.current ? takeNumber(blockRef.current) : null;
      if (!retry) return null;
      blockRef.current = retry.block;
      await OfflineSalesService.saveBlock(retry.block);
      return retry.number;
    }

    blockRef.current = taken.block;
    await OfflineSalesService.saveBlock(taken.block);
    return taken.number;
  }, [branchId, enabled, ensureBlock]);

  const syncNow = useCallback(async () => {
    await OfflineSyncService.drain();
    await refreshSnapshot();
  }, [refreshSnapshot]);

  return { snapshot, takeTicketNumber, syncNow, refreshSnapshot };
}

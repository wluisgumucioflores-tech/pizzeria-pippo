import { STORE, dbDelete, dbGet, dbGetAll, dbPut } from "@/lib/offline-db";
import { generateUUID } from "@/lib/uuid";
import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { todayInBolivia } from "@/lib/timezone";
import { NUMBER_BLOCK_SIZE, type NumberBlock, type QueuedSale } from "@/lib/offline-queue";

const DEVICE_ID_KEY = "device_id";

/** Stable per-browser id so reopening the POS reuses its reserved range. */
async function getDeviceId(): Promise<string> {
  const existing = await dbGet<string>(STORE.meta, DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = generateUUID();
  await dbPut(STORE.meta, DEVICE_ID_KEY, fresh);
  return fresh;
}

function blockKey(branchId: string): string {
  return `${branchId}:${todayInBolivia()}`;
}

export const OfflineSalesService = {
  getDeviceId,

  // --- Sales queue -------------------------------------------------------

  async enqueue(sale: QueuedSale): Promise<void> {
    await dbPut(STORE.salesQueue, sale.idempotencyKey, sale);
  },

  async list(): Promise<QueuedSale[]> {
    try {
      return await dbGetAll<QueuedSale>(STORE.salesQueue);
    } catch {
      return [];
    }
  },

  async update(sale: QueuedSale): Promise<void> {
    await dbPut(STORE.salesQueue, sale.idempotencyKey, sale);
  },

  async remove(idempotencyKey: string): Promise<void> {
    await dbDelete(STORE.salesQueue, idempotencyKey);
  },

  // --- Reserved ticket numbers -------------------------------------------

  async readBlock(branchId: string): Promise<NumberBlock | null> {
    try {
      const block = await dbGet<NumberBlock>(STORE.numberBlocks, blockKey(branchId));
      // A block from a previous day is useless — numbering restarts daily.
      if (!block || block.day !== todayInBolivia()) return null;
      return block;
    } catch {
      return null;
    }
  },

  async saveBlock(block: NumberBlock): Promise<void> {
    await dbPut(STORE.numberBlocks, blockKey(block.branchId), block);
  },

  /**
   * Reserves a fresh range from the server. Needs the network, so it is called
   * while the connection still works — never at the moment of an offline sale.
   */
  async reserveBlock(branchId: string): Promise<NumberBlock | null> {
    try {
      const res = await nestFetch(
        API_ENDPOINTS.orders.numberBlock,
        {
          method: "POST",
          body: JSON.stringify({
            branch_id: branchId,
            size: NUMBER_BLOCK_SIZE,
            device_id: await getDeviceId(),
          }),
        },
        { timeoutMs: 10_000 },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { range_start: number; range_end: number; reused: boolean };

      const day = todayInBolivia();
      const existing = await this.readBlock(branchId);
      // Reusing our own range after a reload: keep the local cursor, otherwise
      // the device would re-hand numbers it already printed on tickets.
      const nextNumber =
        data.reused && existing && existing.rangeStart === data.range_start
          ? existing.nextNumber
          : data.range_start;

      const block: NumberBlock = {
        branchId,
        day,
        rangeStart: data.range_start,
        rangeEnd: data.range_end,
        nextNumber,
      };
      await this.saveBlock(block);
      return block;
    } catch {
      return null;
    }
  },
};

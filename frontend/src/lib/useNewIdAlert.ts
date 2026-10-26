import { useEffect, useRef } from "react";

/**
 * Fires `onNew` when an id shows up that wasn't in the previous list.
 *
 * `loaded` says whether the initial fetch has finished. Nothing is tracked and
 * nothing fires until it turns true, and the list present at that moment is
 * taken as the baseline — so the orders that were already "ready" when the
 * screen opened never beep. Keying the baseline off the first effect run
 * instead (the previous behaviour) fired for the whole day's backlog, because
 * that run happens on the first render, before the data has arrived.
 */
export function useNewIdAlert(ids: string[], onNew: () => void, loaded = true): void {
  const seenRef = useRef<Set<string> | null>(null);

  // Depend on the CONTENT, not on the array identity: callers build this list
  // inline (`orders.filter(...).map(...)`), so a fresh array arrives on every
  // render and the effect would re-run on every unrelated state change.
  const key = ids.join(",");

  useEffect(() => {
    if (!loaded) return;

    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const seen = seenRef.current;
    const hasNew = ids.some((id) => !seen.has(id));
    for (const id of ids) seen.add(id);
    if (hasNew) onNew();
    // `ids` is intentionally not a dependency — `key` tracks its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded, onNew]);
}

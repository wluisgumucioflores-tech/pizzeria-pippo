"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

interface RefreshContextValue {
  registerHandler: (handler: (() => void) | null) => void;
  trigger: () => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

// One instance lives at the admin layout root, so it survives route navigation.
// Whichever page is mounted is the only one registered — the header's refresh
// button always re-runs whatever the current page last registered.
export function RefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<(() => void) | null>(null);

  const registerHandler = useCallback((handler: (() => void) | null) => {
    handlerRef.current = handler;
  }, []);

  const trigger = useCallback(() => {
    handlerRef.current?.();
  }, []);

  return <RefreshContext.Provider value={{ registerHandler, trigger }}>{children}</RefreshContext.Provider>;
}

// Pages call this with their own refetch function (e.g. a hook's `load`/`mutate`)
// so the header's refresh button reloads whatever is on screen, without a full
// page reload. Registers on mount and clears itself on unmount, so navigating
// away doesn't leave a stale handler behind for the next page.
export function useRegisterRefresh(refetch: () => void) {
  const ctx = useContext(RefreshContext);

  // Ref indirection: `refetch` is usually a new function identity every render
  // (e.g. a useCallback with deps, or a plain closure), but we only want to
  // register/unregister once per mount, not re-run the effect on every render.
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const handler = () => refetchRef.current();
    ctx?.registerHandler(handler);
    return () => ctx?.registerHandler(null);
  }, [ctx]);
}

export function useTriggerRefresh() {
  const ctx = useContext(RefreshContext);
  return useCallback(() => ctx?.trigger(), [ctx]);
}

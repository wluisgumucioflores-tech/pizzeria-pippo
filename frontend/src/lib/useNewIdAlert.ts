import { useEffect, useRef } from "react";

// Dispara onNew cuando aparece un id que no estaba en la lista anterior.
// La primera vez que llegan ids no dispara nada (evita sonar por datos que
// ya existían al cargar la pantalla) — solo alerta por llegadas posteriores.
export function useNewIdAlert(ids: string[], onNew: () => void): void {
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(ids);
      return;
    }
    const seen = seenRef.current;
    const hasNew = ids.some((id) => !seen.has(id));
    for (const id of ids) seen.add(id);
    if (hasNew) onNew();
  }, [ids, onNew]);
}

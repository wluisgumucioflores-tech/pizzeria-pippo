"use client";

import { useCallback, useEffect, useState } from "react";

const MESERO_NAME_STORAGE_KEY = "pippo_mesero_name";

// El nombre del mesero es puramente local al dispositivo — no es parte del
// login (el perfil "mesero" es compartido por sucursal), solo identifica
// quién está usando la tablet en este momento para etiquetar sus pedidos.
export function useMeseroName() {
  const [name, setNameState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setNameState(localStorage.getItem(MESERO_NAME_STORAGE_KEY));
    setLoaded(true);
  }, []);

  const setName = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    localStorage.setItem(MESERO_NAME_STORAGE_KEY, trimmed);
    setNameState(trimmed);
  }, []);

  const clearName = useCallback(() => {
    localStorage.removeItem(MESERO_NAME_STORAGE_KEY);
    setNameState(null);
  }, []);

  return { name, loaded, setName, clearName };
}

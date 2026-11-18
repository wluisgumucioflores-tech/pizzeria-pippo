"use client";

import { useState, useCallback } from "react";
import { CashboxService } from "../services/cashbox.service";
import type { CashSessionListRow } from "../types/cashbox.types";

export function useCashSessionsReport() {
  const [sessions, setSessions] = useState<CashSessionListRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (params: string) => {
    setLoading(true);
    setSessions(await CashboxService.listSessions(params));
    setLoading(false);
  }, []);

  return { sessions, loading, fetch };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AttendanceScanService } from "../services/attendance-scan.service";

type Status = "idle" | "loading" | "success" | "error";
type ScanTranslator = ReturnType<typeof useTranslations>;

function buildMessage(
  result: { employee: { full_name: string }; type: "entrada" | "salida"; occurred_at: string },
  t: ScanTranslator,
  tAttendance: ScanTranslator
): string {
  const time = new Date(result.occurred_at).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
  const label = result.type === "entrada" ? tAttendance("typeIn") : tAttendance("typeOut");
  return t("welcomeMessage", { name: result.employee.full_name, type: label, time });
}

export function useAttendanceScan() {
  const t = useTranslations("attendance.scan");
  const tAttendance = useTranslations("attendance");
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [status, setStatus] = useState<Status>(token ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [resultType, setResultType] = useState<"entrada" | "salida" | null>(null);
  const [manualCode, setManualCode] = useState("");
  // React Strict Mode (dev) monta el componente dos veces a propósito para
  // detectar efectos no idempotentes — sin este guard, el POST de fichaje
  // (que NO es idempotente: cada llamada crea una fila nueva) se disparaba
  // dos veces y duplicaba el registro de entrada/salida.
  const hasScanned = useRef(false);

  useEffect(() => {
    if (!token || hasScanned.current) return;
    hasScanned.current = true;
    runScan({ token });
    // Solo al montar — el token viene de la URL con la que se abrió la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runScan = async (payload: { token?: string; manual_code?: string }) => {
    setStatus("loading");
    const response = await AttendanceScanService.scan(payload);
    if (response.ok && response.result) {
      setMessage(buildMessage(response.result, t, tAttendance));
      setResultType(response.result.type);
      setStatus("success");
    } else {
      setMessage(response.error ?? t("errorDefault"));
      setStatus("error");
    }
  };

  const submitManualCode = () => {
    if (!manualCode.trim()) return;
    runScan({ manual_code: manualCode.trim() });
  };

  return { status, message, resultType, manualCode, setManualCode, submitManualCode };
}

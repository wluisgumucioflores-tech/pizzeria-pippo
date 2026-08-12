"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/auth";

// El (pos)/layout.tsx original no chequeaba rol — cualquier autenticado
// entraba. Quedó expuesto al agregar el rol mesero (Fase 1 de
// docs/features/mesero-y-mejoras-pos/), que no debe operar el POS.
export function PosAccessGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      if (profile.role !== "cajero" && profile.role !== "admin") {
        window.location.href = "/login";
        return;
      }
      setAllowed(true);
    });
  }, []);

  if (!allowed) return null;
  return <>{children}</>;
}

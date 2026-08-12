"use client";

import { useEffect, useState } from "react";
import { getToken, getUserProfile } from "@/lib/auth";

// Chequeo periódico además del de montaje: la sesión de mesero expira a las
// 6h (backend, auth.service.ts) y la tablet puede quedar en esta pantalla
// sin navegar — sin este poll, el cierre de sesión no se notaba hasta la
// próxima acción que dispara un fetch.
const SESSION_CHECK_INTERVAL_MS = 60_000;

export default function MeseroLayout({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      if (profile.role !== "mesero" && profile.role !== "admin") {
        window.location.href = "/login";
        return;
      }
      setAllowed(true);
    });

    const interval = setInterval(async () => {
      const token = await getToken();
      if (!token) window.location.href = "/login";
    }, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!allowed) return null;
  return <>{children}</>;
}

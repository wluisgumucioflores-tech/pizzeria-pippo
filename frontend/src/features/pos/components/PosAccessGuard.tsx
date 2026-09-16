"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/auth";
import { AnnouncementBanner } from "@/features/announcements/components/AnnouncementBanner";

// El (pos)/layout.tsx original no chequeaba rol — cualquier autenticado
// entraba. Quedó expuesto al agregar el rol mesero (Fase 1 de
// docs/features/mesero-y-mejoras-pos/), que no debe operar el POS.
export function PosAccessGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false);
  const [announcement, setAnnouncement] = useState<{ id: string; message: string } | null>(null);

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
      setAnnouncement(profile.announcement);
      setAllowed(true);
    });
  }, []);

  if (!allowed) return null;
  return (
    <>
      <AnnouncementBanner announcement={announcement} />
      {children}
    </>
  );
}

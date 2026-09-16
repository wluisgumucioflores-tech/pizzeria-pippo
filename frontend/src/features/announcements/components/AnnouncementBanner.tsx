"use client";

import { useEffect, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { BANNER_DISMISSED_PREFIX } from "@/lib/auth";

interface Props {
  announcement: { id: string; message: string } | null;
}

// Dismissed per browser session (sessionStorage), but auth.ts clears
// those flags on every signIn() — by request, it has to reappear on
// every login, not stay dismissed forever.
export function AnnouncementBanner({ announcement }: Props) {
  const t = useTranslations("common");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!announcement) {
      setDismissed(true);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(`${BANNER_DISMISSED_PREFIX}${announcement.id}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [announcement]);

  if (!announcement || dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(`${BANNER_DISMISSED_PREFIX}${announcement.id}`, "1");
    } catch {
      // Private mode / storage unavailable: still hide it for this page load.
    }
  };

  // More text, more time per loop — so the speed feels consistent instead
  // of a long message rushing by.
  const duration = Math.max(12, Math.min(35, announcement.message.length * 0.18));

  return (
    <div style={{ background: "#f97316", color: "#fff", display: "flex", alignItems: "center", height: 36, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <span
          style={{
            display: "inline-block",
            paddingLeft: "100%",
            whiteSpace: "nowrap",
            fontSize: 13,
            fontWeight: 600,
            animation: `pippo-marquee ${duration}s linear infinite`,
          }}
        >
          {announcement.message}
        </span>
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label={t("close")}
        style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: "0 12px", display: "flex", alignItems: "center", height: "100%", flexShrink: 0 }}
      >
        <CloseOutlined />
      </button>
    </div>
  );
}

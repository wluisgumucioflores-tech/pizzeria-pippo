"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useDisplay } from "@/features/display/hooks/useDisplay";
import { DisplayMenu } from "@/features/display/components/DisplayMenu";
import { DisplayCart } from "@/features/display/components/DisplayCart";
import { DisplayThankYou } from "@/features/display/components/DisplayThankYou";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";

export default function DisplayPage() {
  const { mode, cartItems, cartTotal, orderType, products, menuPage } = useDisplay();
  const t = useTranslations("display");

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", background: "#030712", color: "#fff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", background: "#ea580c", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image
            src="/logo.png"
            alt="Pippo Pizza"
            width={44}
            height={44}
            style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.02em" }}>Pizzería Pippo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#fed7aa", fontSize: 16 }}>
            {mode === "order"
              ? orderType === "takeaway" ? t("orderTypeTakeaway") : t("orderTypeDineIn")
              : mode === "thanks" ? ""
              : t("ourMenu")}
          </span>
          <LocaleSwitcher dark />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {mode === "thanks" && <DisplayThankYou />}
        {mode === "order" && <DisplayCart cartItems={cartItems} cartTotal={cartTotal} />}
        {mode === "menu" && <DisplayMenu products={products} menuPage={menuPage} />}
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button, Dropdown } from "antd";
import { GlobalOutlined } from "@ant-design/icons";
import { setLocale } from "@/app/actions/set-locale";

interface Props {
  /** Use light text/icon color for dark backgrounds (kitchen, display). */
  dark?: boolean;
}

export function LocaleSwitcher({ dark }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("localeSwitcher");

  function handleSelect(next: "es" | "en") {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        selectedKeys: [locale],
        items: [
          { key: "es", label: t("es") },
          { key: "en", label: t("en") },
        ],
        onClick: ({ key }) => handleSelect(key as "es" | "en"),
      }}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        loading={isPending}
        title={locale === "en" ? t("en") : t("es")}
        style={dark ? { color: "#fff" } : undefined}
      >
        {locale.toUpperCase()}
      </Button>
    </Dropdown>
  );
}

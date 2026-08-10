"use client";

import { Progress, Tooltip } from "antd";
import { useTranslations } from "next-intl";
import { AuthorizedChat } from "@/features/telegram-bot/types";

const PLAN_LIMITS: Record<string, number> = {
  basic: 10,
  pro: 50,
  unlimited: 99999,
};

interface Props {
  chat: AuthorizedChat;
}

export function UsageIndicator({ chat }: Props) {
  const t = useTranslations("settings.chats");
  const limit = PLAN_LIMITS[chat.plan] ?? 10;
  const used = chat.messages_today;

  if (chat.plan === "unlimited") {
    return <span style={{ color: "#8c8c8c", fontSize: 13 }}>{used} / ∞</span>;
  }

  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 100 ? "#ff4d4f" : pct >= 80 ? "#fa8c16" : "#52c41a";

  return (
    <Tooltip title={t("usageTooltip", { used, limit })}>
      <div style={{ minWidth: 80 }}>
        <div style={{ fontSize: 12, color: "#595959", marginBottom: 2 }}>{used} / {limit}</div>
        <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
      </div>
    </Tooltip>
  );
}

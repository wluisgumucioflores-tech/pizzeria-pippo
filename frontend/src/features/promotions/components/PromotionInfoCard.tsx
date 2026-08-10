"use client";

import { Card, Space, Tag, Typography, Badge, Divider } from "antd";
import { useTranslations } from "next-intl";
import { getDays } from "../constants/promotion.constants";
import type { Promotion } from "../types/promotion.types";

const { Text } = Typography;

interface Props {
  promotion: Promotion;
  typeLabel: string;
  typeColor: string;
  branchName: string | null;
}

export function PromotionInfoCard({ promotion, typeLabel, typeColor, branchName }: Props) {
  const tp = useTranslations("promotions");
  const DAYS = getDays(tp);

  return (
    <Card>
      <Space wrap style={{ marginBottom: 16 }}>
        <Tag color={typeColor}>{typeLabel}</Tag>
        {promotion.active
          ? <Badge status="success" text={tp("statusActivePos")} />
          : <Badge status="default" text={tp("statusPausedPos")} />}
      </Space>

      <Divider style={{ margin: "12px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{tp("branch")}</Text>
          {branchName ? <Tag>{branchName}</Tag> : <Tag color="purple">{tp("allBranches")}</Tag>}
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{tp("validity")}</Text>
          <Text>{promotion.start_date} → {promotion.end_date}</Text>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>{tp("activeDays")}</Text>
          <Space size={4} wrap>
            {DAYS.map((d) => (
              <Tag key={d.value} color={promotion.days_of_week.includes(d.value) ? "blue" : "default"}>
                {d.label}
              </Tag>
            ))}
          </Space>
        </div>
      </div>
    </Card>
  );
}

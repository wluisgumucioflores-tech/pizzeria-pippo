"use client";

import { Typography, Tag, Space } from "antd";
import { useTranslations } from "next-intl";
import { MOVEMENT_TYPE_COLORS, getMovementTypeLabels } from "../types/warehouse-movements.types";
import type { UnifiedMovement } from "../types/warehouse-movements.types";

const { Text } = Typography;

interface Props {
  movements: UnifiedMovement[];
  loading: boolean;
}

export function WarehouseMovementsMobileList({ movements, loading }: Props) {
  const t = useTranslations("warehouse.movements");
  const MOVEMENT_TYPE_LABELS = getMovementTypeLabels(t);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{t("loading")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {movements.map((r) => {
        const display = r.type === "compra" || r.quantity >= 0 ? `+${r.quantity}` : `${r.quantity}`;
        return (
          <div key={r.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Space size={4}>
                <Tag color={MOVEMENT_TYPE_COLORS[r.type]} style={{ margin: 0 }}>{MOVEMENT_TYPE_LABELS[r.type] ?? r.type}</Tag>
                {r.origin === "ingredient"
                  ? <Tag color="default" style={{ margin: 0 }}>{t("originIngredient")}</Tag>
                  : <Tag color="purple" style={{ margin: 0 }}>{t("originProduct")}</Tag>}
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString("es-BO")}</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Text strong>{r.detailName}</Text>
                {r.unit && <Tag style={{ margin: "0 0 0 6px" }}>{r.unit}</Tag>}
              </div>
              <Text strong style={{ color: r.quantity >= 0 ? "#16a34a" : "#ef4444", fontSize: 15 }}>
                {display} {r.unit}
              </Text>
            </div>
            {(r.branches || r.notes) && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {r.branches && <Tag style={{ margin: 0 }}>→ {r.branches.name}</Tag>}
                {r.notes && <Text type="secondary" style={{ fontSize: 12 }}>{r.notes}</Text>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

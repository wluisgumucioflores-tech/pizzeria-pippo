"use client";

import { Alert, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { OnlineOrderRow } from "../types/manage.types";

const { Text } = Typography;

// Expanded row of the history table, and the detail block of the mobile card.
// Shared so the two never drift on what a request actually contained.
export function OnlineOrderDetail({ row }: { row: OnlineOrderRow }) {
  const t = useTranslations("onlineOrdersAdmin");

  return (
    <div style={{ paddingLeft: 8 }}>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {row.items.map((item) => (
          <li key={item.variant_id}>
            <Text>
              {item.qty}× {item.product_name} {item.variant_name}
            </Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              Bs {(Math.round(item.unit_price * item.qty * 100) / 100).toFixed(2)}
            </Text>
          </li>
        ))}
      </ul>

      {row.notes && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("detail.customerNote")}:{" "}
          </Text>
          <Text style={{ fontSize: 12 }}>{row.notes}</Text>
        </div>
      )}

      {/* The reason the business gave the customer — worth surfacing, it is
          the only record of why a request was turned down. */}
      {row.status === "rejected" && row.reject_reason && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
          message={`${t("detail.rejectReason")}: ${row.reject_reason}`}
        />
      )}

      {row.status === "expired" && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message={t("detail.expiredHint")}
        />
      )}
    </div>
  );
}

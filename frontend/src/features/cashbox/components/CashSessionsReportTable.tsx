"use client";

import { Card, Table, Tag } from "antd";
import { useTranslations } from "next-intl";
import { formatDateTimeBolivia } from "@/lib/timezone";
import type { CashSessionListRow, CashSessionStatus } from "../types/cashbox.types";

const STATUS_COLOR: Record<CashSessionStatus, string> = {
  open: "blue",
  closed: "green",
  auto_closed: "orange",
};

interface Props {
  sessions: CashSessionListRow[];
  loading: boolean;
}

export function CashSessionsReportTable({ sessions, loading }: Props) {
  const t = useTranslations("cashbox.report");

  const formatDiff = (row: CashSessionListRow) => {
    if (row.difference === null) return "—";
    const sign = row.difference > 0 ? "+ " : row.difference < 0 ? "− " : "";
    return `${sign}Bs ${Math.abs(row.difference).toFixed(2)}`;
  };

  const columns = [
    { title: t("columns.date"), dataIndex: "opened_at", key: "opened_at", render: (d: string) => formatDateTimeBolivia(d) },
    { title: t("columns.branch"), dataIndex: "branch_name", key: "branch_name" },
    { title: t("columns.cashier"), dataIndex: "cashier_name", key: "cashier_name" },
    { title: t("columns.opening"), dataIndex: "opening_amount", key: "opening_amount", render: (v: number) => `Bs ${v.toFixed(2)}` },
    { title: t("columns.sales"), dataIndex: "cash_sales", key: "cash_sales", render: (v: number) => `Bs ${v.toFixed(2)}` },
    { title: t("columns.expenses"), dataIndex: "expenses_total", key: "expenses_total", render: (v: number) => `Bs ${v.toFixed(2)}` },
    {
      title: t("columns.closing"),
      dataIndex: "counted_amount",
      key: "counted_amount",
      render: (v: number | null) => (v === null ? "—" : `Bs ${v.toFixed(2)}`),
    },
    {
      title: t("columns.difference"),
      key: "difference",
      render: (_: unknown, row: CashSessionListRow) => (
        <span style={{ color: row.difference && row.difference < 0 ? "#dc2626" : row.difference && row.difference > 0 ? "#d97706" : undefined }}>
          {formatDiff(row)}
        </span>
      ),
    },
    {
      title: t("columns.status"),
      dataIndex: "status",
      key: "status",
      render: (status: CashSessionStatus) => <Tag color={STATUS_COLOR[status]}>{t(`status.${status}`)}</Tag>,
    },
  ];

  return (
    <Card>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={sessions}
        loading={loading}
        locale={{ emptyText: t("empty") }}
        scroll={{ x: true }}
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
}

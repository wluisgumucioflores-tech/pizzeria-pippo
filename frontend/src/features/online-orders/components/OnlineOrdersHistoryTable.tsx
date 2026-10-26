"use client";

import { Table, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { STATUS_TAG_COLOR } from "../constants/online-orders.constants";
import { OnlineOrderDetail } from "./OnlineOrderDetail";
import { HISTORY_PAGE_SIZE } from "../lib/history-query";
import type { OnlineOrderRow } from "../types/manage.types";
import type { Branch } from "@/features/branches/types/branch.types";

const { Text } = Typography;

interface Props {
  rows: OnlineOrderRow[];
  branches: Branch[];
  count: number;
  page: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function OnlineOrdersHistoryTable({
  rows,
  branches,
  count,
  page,
  loading,
  onPageChange,
}: Props) {
  const t = useTranslations("onlineOrdersAdmin");
  const branchName = (id: string) =>
    branches.find((branch) => branch.id === id)?.name ?? "—";

  const columns = [
    {
      title: t("columns.reference"),
      dataIndex: "reference",
      key: "reference",
      render: (reference: string) => <Text strong>#{reference}</Text>,
    },
    {
      title: t("columns.branch"),
      dataIndex: "branch_id",
      key: "branch_id",
      render: (id: string) => <Text>{branchName(id)}</Text>,
    },
    {
      title: t("columns.customer"),
      key: "customer",
      render: (_: unknown, row: OnlineOrderRow) => (
        <div>
          <Text>{row.customer_name}</Text>
          <br />
          {/* Tappable: the admin calling the customer back is the whole
              reason the phone is stored. */}
          <a href={`tel:${row.customer_phone}`} style={{ fontSize: 12 }}>
            {row.customer_phone}
          </a>
        </div>
      ),
    },
    {
      title: t("columns.createdAt"),
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => (
        <Text style={{ fontSize: 13 }}>
          {new Date(value).toLocaleString("es-BO", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      ),
    },
    {
      title: t("columns.status"),
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={STATUS_TAG_COLOR[status] ?? "default"}>{t(`status.${status}`)}</Tag>
      ),
    },
    {
      // No link: there is no per-order admin page to land on, so this shows
      // the ticket number the kitchen and the cashier actually use.
      title: t("columns.sale"),
      dataIndex: "daily_number",
      key: "daily_number",
      render: (dailyNumber: number | null) =>
        dailyNumber === null ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text strong>#{dailyNumber}</Text>
        ),
    },
    {
      title: t("columns.total"),
      dataIndex: "total",
      key: "total",
      align: "right" as const,
      render: (total: number) => <Text strong>Bs {total.toFixed(2)}</Text>,
    },
  ];

  return (
    <Table
      dataSource={rows}
      columns={columns}
      rowKey="id"
      loading={loading}
      size="middle"
      scroll={{ x: 900 }}
      expandable={{
        expandedRowRender: (row) => <OnlineOrderDetail row={row} />,
        rowExpandable: () => true,
      }}
      pagination={{
        current: page,
        pageSize: HISTORY_PAGE_SIZE,
        total: count,
        showSizeChanger: false,
        onChange: onPageChange,
      }}
    />
  );
}

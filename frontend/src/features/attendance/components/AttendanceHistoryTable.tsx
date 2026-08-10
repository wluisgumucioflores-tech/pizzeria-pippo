"use client";

import { Table, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { AttendanceRecord } from "../types/attendance.types";

const { Text } = Typography;

interface Props {
  records: AttendanceRecord[];
  loading: boolean;
}

export function AttendanceHistoryTable({ records, loading }: Props) {
  const t = useTranslations("attendance");
  return (
    <Table
      dataSource={records}
      loading={loading}
      rowKey="id"
      size="small"
      columns={[
        { title: t("columns.employee"), dataIndex: "employee_name" },
        { title: t("columns.position"), dataIndex: "position" },
        { title: t("columns.branch"), dataIndex: "branch_name" },
        {
          title: t("columns.type"),
          dataIndex: "type",
          render: (type: string) => (
            <Tag color={type === "entrada" ? "green" : "orange"}>{type === "entrada" ? t("typeIn") : t("typeOut")}</Tag>
          ),
        },
        {
          title: t("columns.dateTime"),
          dataIndex: "created_at",
          render: (createdAt: string) => <Text>{new Date(createdAt).toLocaleString("es-BO")}</Text>,
        },
      ]}
    />
  );
}

"use client";

import { Table, Button, Typography, Space, Popconfirm, DatePicker } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Dayjs } from "dayjs";
import { useIsMobile } from "@/lib/useIsMobile";
import type { IngredientUsageLog } from "../types/production.types";

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface Props {
  logs: IngredientUsageLog[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  dateRange: [Dayjs, Dayjs] | null;
  onDateRangeChange: (range: [Dayjs, Dayjs] | null) => void;
  onCreate: () => void;
  onEdit: (record: IngredientUsageLog) => void;
  onDelete: (record: IngredientUsageLog) => void;
}

export function IngredientUsageTable({
  logs, loading, page, total, pageSize, onPageChange, dateRange, onDateRangeChange, onCreate, onEdit, onDelete,
}: Props) {
  const t = useTranslations("production");
  const tc = useTranslations("common");
  const isMobile = useIsMobile();

  return (
    <div className="p-3 md:p-6">
      <div className="flex justify-between items-center flex-wrap gap-2 mb-5">
        <Title level={4} style={{ margin: 0 }}>{t("ingredientUsage.title")}</Title>
        <Space wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => onDateRangeChange(dates?.[0] && dates?.[1] ? [dates[0], dates[1]] : null)}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            {t("ingredientUsage.new")}
          </Button>
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={logs}
        scroll={{ x: 480 }}
        pagination={{ current: page, pageSize, total, onChange: onPageChange, showSizeChanger: false, simple: isMobile }}
        columns={[
          { title: t("table.ingredient"), dataIndex: "ingredient_name" },
          { title: t("table.quantity"), dataIndex: "quantity", render: (q: number, row) => `${q} ${row.unit}` },
          { title: t("table.when"), dataIndex: "created_at", render: (v: string) => new Date(v).toLocaleString() },
          {
            title: tc("actions"),
            key: "actions",
            width: 100,
            render: (_: unknown, row: IngredientUsageLog) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title={t("deleteConfirm.title")}
                  onConfirm={() => onDelete(row)}
                  okText={tc("delete")}
                  cancelText={tc("cancel")}
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}

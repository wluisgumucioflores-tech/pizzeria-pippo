"use client";

import { Card, Col, DatePicker, Row, Select, Statistic, Typography } from "antd";
import { useTranslations } from "next-intl";
import dayjs, { type Dayjs } from "dayjs";
import { ONLINE_ORDER_STATUSES } from "../types/manage.types";
import type { OnlineOrderStatusFilter } from "../types/manage.types";
import type { Branch } from "@/features/branches/types/branch.types";

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Props {
  branches: Branch[];
  branchId: string;
  status: OnlineOrderStatusFilter | "all";
  dateRange: [Dayjs, Dayjs];
  count: number;
  totalAmount: number;
  loading: boolean;
  onBranchChange: (value: string) => void;
  onStatusChange: (value: OnlineOrderStatusFilter | "all") => void;
  onDateRangeChange: (value: [Dayjs, Dayjs]) => void;
}

export function OnlineOrdersHistoryFilters({
  branches,
  branchId,
  status,
  dateRange,
  count,
  totalAmount,
  loading,
  onBranchChange,
  onStatusChange,
  onDateRangeChange,
}: Props) {
  const t = useTranslations("onlineOrdersAdmin");

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t("filters.branch")}</Text>
          <Select
            value={branchId}
            onChange={onBranchChange}
            style={{ width: "100%" }}
            options={[
              { value: "all", label: t("filters.allBranches") },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t("filters.status")}</Text>
          <Select
            value={status}
            onChange={onStatusChange}
            style={{ width: "100%" }}
            options={[
              { value: "all", label: t("filters.allStatuses") },
              ...ONLINE_ORDER_STATUSES.map((key) => ({
                value: key,
                label: t(`status.${key}`),
              })),
            ]}
          />
        </Col>

        <Col xs={24} md={12}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t("filters.dateRange")}</Text>
          <RangePicker
            value={dateRange}
            allowClear={false}
            style={{ width: "100%" }}
            format="DD/MM/YYYY"
            // No future dates: an online request can't exist tomorrow, and a
            // range into the future just returns nothing.
            disabledDate={(current) => current && current > dayjs().endOf("day")}
            onChange={(values) => {
              if (values?.[0] && values?.[1]) onDateRangeChange([values[0], values[1]]);
            }}
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
        <Col xs={12} md={6}>
          <Statistic title={t("summary.count")} value={count} loading={loading} />
        </Col>
        <Col xs={12} md={6}>
          {/* Deliberately labelled as the total of what is LISTED, not
              "revenue": with the status filter on "all" it also sums rejected
              and expired requests, which never became money. */}
          <Statistic
            title={t("summary.totalAmount")}
            value={totalAmount}
            precision={2}
            prefix="Bs"
            loading={loading}
            valueStyle={{ color: "#ea580c" }}
          />
        </Col>
      </Row>
    </Card>
  );
}

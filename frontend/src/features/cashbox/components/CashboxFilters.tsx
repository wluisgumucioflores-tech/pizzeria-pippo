"use client";

import { Card, Col, DatePicker, Row, Select, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { Dayjs } from "dayjs";
import type { Branch } from "@/features/branches/types/branch.types";

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Props {
  branches: Branch[];
  branchId: string;
  dateRange: [Dayjs, Dayjs];
  onBranchChange: (value: string) => void;
  onDateRangeChange: (value: [Dayjs, Dayjs]) => void;
}

export function CashboxFilters({ branches, branchId, dateRange, onBranchChange, onDateRangeChange }: Props) {
  const t = useTranslations("cashbox.page.filters");

  return (
    <Card style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="bottom">
        <Col xs={24} sm={12} md={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t("branch")}</Text>
          <Select
            value={branchId}
            onChange={onBranchChange}
            style={{ width: "100%" }}
            options={[
              { value: "all", label: t("allBranches") },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t("dateRange")}</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates?.[0] && dates?.[1] && onDateRangeChange([dates[0], dates[1]])}
            format="DD/MM/YYYY"
            style={{ width: "100%" }}
          />
        </Col>
      </Row>
    </Card>
  );
}

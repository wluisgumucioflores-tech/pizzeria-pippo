"use client";

import { useRouter } from "next/navigation";
import { Table, Button, Space, Tag, Typography, Switch, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { getTypeOptions, TYPE_COLORS, getDays } from "../constants/promotion.constants";
import { useIsMobile } from "@/lib/useIsMobile";
import type { Promotion, Branch } from "../types/promotion.types";

const { Title, Text } = Typography;

interface Props {
  promotions: Promotion[];
  branches: Branch[];
  loading: boolean;
  showInactive: boolean;
  onToggleInactive: (val: boolean) => void;
  onCreate: () => void;
  onEdit: (promo: Promotion) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleIsActive: (promo: Promotion) => void;
}

export function PromotionsTable({ promotions, branches, loading, showInactive, onToggleInactive, onCreate, onEdit, onToggleActive, onToggleIsActive }: Props) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const tCommon = useTranslations("common");
  const tp = useTranslations("promotions");
  const TYPE_OPTIONS = getTypeOptions(tp);
  const DAYS = getDays(tp);

  const columns = [
    { title: tp("name"), dataIndex: "name", key: "name" },
    {
      title: tp("type"),
      dataIndex: "type",
      key: "type",
      render: (t: string) => <Tag color={TYPE_COLORS[t]}>{TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t}</Tag>,
    },
    {
      title: tp("days"),
      dataIndex: "days_of_week",
      key: "days_of_week",
      render: (days: number[]) => (
        <Space size={2}>
          {DAYS.map((d) => (
            <Tag key={d.value} color={days.includes(d.value) ? "blue" : "default"}>{d.label}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: tp("validity"),
      key: "dates",
      render: (_: unknown, r: Promotion) => (
        <Text style={{ fontSize: 12 }}>{r.start_date} → {r.end_date}</Text>
      ),
    },
    {
      title: tp("branch"),
      key: "branch",
      render: (_: unknown, r: Promotion) =>
        r.branch_id
          ? <Tag>{branches.find((b) => b.id === r.branch_id)?.name ?? r.branch_id}</Tag>
          : <Tag color="purple">{tp("allBranches")}</Tag>,
    },
    {
      title: tp("active"),
      key: "active",
      render: (_: unknown, r: Promotion) => (
        <Switch checked={r.active} size="small" onChange={(val) => onToggleActive(r.id, val)} />
      ),
    },
    {
      title: tCommon("actions"),
      key: "actions",
      width: 100,
      render: (_: unknown, r: Promotion) => (
        <Space>
          <Tooltip title={tp("viewDetail")}>
            <Button icon={<EyeOutlined />} size="small" onClick={() => router.push(`/promotions/${r.id}`)} />
          </Tooltip>
          <Tooltip title={tCommon("edit")}>
            <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(r)} />
          </Tooltip>
          <Tooltip title={r.is_active ? tp("deactivate") : tp("reactivate")}>
            <Button
              icon={r.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              size="small"
              danger={r.is_active}
              onClick={() => onToggleIsActive(r)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
      <Title level={4} style={{ margin: 0 }}>{tp("title")}</Title>
      <Space wrap>
        <Space size={4}>
          <EyeOutlined style={{ color: "#6b7280" }} />
          {!isMobile && <Text type="secondary">{tp("showInactive")}</Text>}
          <Switch size="small" checked={showInactive} onChange={onToggleInactive} />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {isMobile ? tp("newShort") : tp("new")}
        </Button>
      </Space>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {header}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>{tCommon("loading")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {promotions.map((promo) => {
              const activeDays = DAYS.filter((d) => promo.days_of_week.includes(d.value));
              const branchName = promo.branch_id
                ? (branches.find((b) => b.id === promo.branch_id)?.name ?? promo.branch_id)
                : null;
              return (
                <div
                  key={promo.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 14,
                    opacity: promo.is_active ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{promo.name}</Text>
                      <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <Tag color={TYPE_COLORS[promo.type]} style={{ margin: 0 }}>
                          {TYPE_OPTIONS.find((o) => o.value === promo.type)?.label ?? promo.type}
                        </Tag>
                        {branchName
                          ? <Tag style={{ margin: 0 }}>{branchName}</Tag>
                          : <Tag color="purple" style={{ margin: 0 }}>{tp("allBranches")}</Tag>}
                      </div>
                    </div>
                    <Switch checked={promo.active} size="small" onChange={(val) => onToggleActive(promo.id, val)} />
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {activeDays.map((d) => <Tag key={d.value} color="blue" style={{ margin: 0 }}>{d.label}</Tag>)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{promo.start_date} → {promo.end_date}</Text>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => router.push(`/promotions/${promo.id}`)} style={{ flex: 1 }}>
                      {tp("view")}
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(promo)} style={{ flex: 1 }}>
                      {tCommon("edit")}
                    </Button>
                    <Button
                      size="small"
                      icon={promo.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                      danger={promo.is_active}
                      onClick={() => onToggleIsActive(promo)}
                      style={{ flex: 1 }}
                    >
                      {promo.is_active ? tp("deactivate") : tp("reactivate")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      <Table dataSource={promotions} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} />
    </>
  );
}

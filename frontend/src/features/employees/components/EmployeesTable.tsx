"use client";

import { Table, Button, Space, Switch, Typography, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, QrcodeOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Branch } from "@/features/branches/types/branch.types";
import type { Employee } from "../types/employee.types";

interface Props {
  employees: Employee[];
  branches: Branch[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onRegenerateCredential: (employee: Employee) => void;
}

export function EmployeesTable({ employees, branches, loading, onCreate, onEdit, onToggleActive, onRegenerateCredential }: Props) {
  const t = useTranslations("common");
  const te = useTranslations("employees");
  const branchName = (branchId: string) => branches.find((b) => b.id === branchId)?.name ?? "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>{te("title")}</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {te("new")}
        </Button>
      </div>

      <Table
        dataSource={employees}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          { title: te("columns.name"), dataIndex: "full_name" },
          { title: te("columns.position"), dataIndex: "position" },
          {
            title: te("columns.branch"),
            dataIndex: "branch_id",
            render: (branchId: string) => branchName(branchId),
          },
          {
            title: te("columns.active"),
            dataIndex: "is_active",
            width: 80,
            render: (_: unknown, row: Employee) => (
              <Switch checked={row.is_active} size="small" onChange={() => onToggleActive(row)} />
            ),
          },
          {
            title: t("actions"),
            width: 140,
            render: (_: unknown, row: Employee) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(row)} />
                <Popconfirm
                  title={te("regenerateConfirmTitle")}
                  description={te("regenerateConfirmDesc")}
                  onConfirm={() => onRegenerateCredential(row)}
                  okText={te("regenerate")}
                  cancelText={t("cancel")}
                >
                  <Button size="small" icon={<QrcodeOutlined />} title={te("regenerateTooltip")} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}

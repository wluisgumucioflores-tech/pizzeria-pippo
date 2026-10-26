"use client";

import { Card, Button, Typography, Space } from "antd";
import { ShopOutlined, LogoutOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { Branch } from "../types/pos.types";

const { Title, Text } = Typography;

interface Props {
  branches: Branch[];
  userName: string;
  onSelect: (branchId: string) => void;
  onLogout: () => void;
}

export function BranchSelector({ branches, userName, onSelect, onLogout }: Props) {
  const t = useTranslations("pos.branchSelector");

  return (
    <div className="app-shell-height" style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f5",
      gap: 24,
      padding: 24,
      // app-shell-height now pins this box to the viewport with
      // position:fixed, taking it out of normal document flow — the page can
      // no longer scroll on its own if a business has enough branches to
      // overflow a short screen, so this box provides its own scroll instead.
      overflowY: "auto",
    }}>
      <div style={{ textAlign: "center" }}>
        <Title level={3} style={{ margin: 0 }}>{t("title")}</Title>
        <Text type="secondary">{t("greeting", { name: userName })}</Text>
      </div>

      <Space direction="vertical" style={{ width: "100%", maxWidth: 360 }} size={12}>
        {branches.map((branch) => (
          <Card
            key={branch.id}
            hoverable
            onClick={() => onSelect(branch.id)}
            style={{ cursor: "pointer", borderRadius: 12 }}
            styles={{ body: { padding: "16px 20px" } }}
          >
            <Space>
              <ShopOutlined style={{ fontSize: 20, color: "#f97316" }} />
              <Text strong style={{ fontSize: 16 }}>{branch.name}</Text>
            </Space>
          </Card>
        ))}
      </Space>

      <Button icon={<LogoutOutlined />} type="text" onClick={onLogout}>
        {t("logout")}
      </Button>
    </div>
  );
}

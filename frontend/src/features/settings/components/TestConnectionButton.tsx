"use client";

import { Button, Space } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, ApiOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

interface Props {
  testing: boolean;
  testResult: "idle" | "success" | "error";
  testError: string;
  disabled: boolean;
  onTest: () => void;
}

export function TestConnectionButton({ testing, testResult, testError, disabled, onTest }: Props) {
  const t = useTranslations("settings");
  return (
    <Space direction="vertical" size={4}>
      <Button
        icon={<ApiOutlined />}
        onClick={onTest}
        loading={testing}
        disabled={disabled}
      >
        {t("testConnection")}
      </Button>

      {testResult === "success" && (
        <Space style={{ color: "#52c41a", fontSize: 13 }}>
          <CheckCircleOutlined />
          {t("testSuccess")}
        </Space>
      )}

      {testResult === "error" && (
        <Space style={{ color: "#ff4d4f", fontSize: 13 }}>
          <CloseCircleOutlined />
          {testError}
        </Space>
      )}
    </Space>
  );
}

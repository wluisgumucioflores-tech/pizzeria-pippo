"use client";

import { Modal, Typography, Input, Button, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface Props {
  apiKey: string | null;
  onClose: () => void;
}

export function AiChatApiKeyModal({ apiKey, onClose }: Props) {
  const t = useTranslations("settings.aiChat.apiKeyModal");

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    message.success(t("copied"));
  };

  return (
    <Modal
      title={t("title")}
      open={!!apiKey}
      onOk={onClose}
      onCancel={onClose}
      okText={t("gotIt")}
      cancelButtonProps={{ style: { display: "none" } }}
      closable={false}
      maskClosable={false}
    >
      <Text type="warning" strong style={{ display: "block", marginBottom: 12 }}>
        {t("warning")}
      </Text>
      <Input.Group compact style={{ display: "flex" }}>
        <Input value={apiKey ?? ""} readOnly style={{ fontFamily: "monospace" }} />
        <Button icon={<CopyOutlined />} onClick={handleCopy} />
      </Input.Group>
      <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 13 }}>
        {t("hint")}
      </Text>
    </Modal>
  );
}

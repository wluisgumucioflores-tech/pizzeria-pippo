"use client";

import { useState } from "react";
import { Modal, Input, Typography, Alert } from "antd";
import { useTranslations } from "next-intl";

const { TextArea } = Input;
const { Text } = Typography;

interface CancelTarget {
  id: string;
  daily_number: number;
}

interface Props {
  order: CancelTarget | null;
  loading: boolean;
  onConfirm: (orderId: string, reason: string) => void;
  onClose: () => void;
}

export function CancelOrderModal({ order, loading, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const t = useTranslations("common");
  const tc = useTranslations("pos.cancelOrderModal");

  const handleConfirm = () => {
    if (!order || !reason.trim()) return;
    onConfirm(order.id, reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  const orderLabel = order ? `#${String(order.daily_number).padStart(2, "0")}` : "";

  return (
    <Modal
      open={!!order}
      title={<Text strong style={{ color: "#dc2626" }}>{tc("title", { label: orderLabel })}</Text>}
      okText={tc("confirm")}
      cancelText={t("cancel")}
      okButtonProps={{ danger: true, loading, disabled: !reason.trim() }}
      onOk={handleConfirm}
      onCancel={handleClose}
      destroyOnClose
    >
      <Alert
        type="warning"
        showIcon
        message={tc("warning")}
        style={{ marginBottom: 16 }}
      />
      <TextArea
        placeholder={tc("reasonPlaceholder")}
        maxLength={200}
        showCount
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
    </Modal>
  );
}

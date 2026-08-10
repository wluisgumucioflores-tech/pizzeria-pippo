"use client";

import { Modal, Button, Spin, Typography } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { PaymentValidationState } from "../types/payment-validation.types";

const { Text, Title } = Typography;

interface Props {
  open: boolean;
  state: PaymentValidationState;
  onConfirm: () => void;
  onReject: () => void;
  onCancel: () => void;
}

export function PaymentValidationModal({ open, state, onConfirm, onReject, onCancel }: Props) {
  const t = useTranslations("pos");
  const tv = useTranslations("pos.paymentValidation");
  const tCommon = useTranslations("common");

  return (
    <Modal title={tv("title")} open={open} onCancel={onCancel} width={380} footer={null} closable={state.status !== "waiting"}>
      <div className="mt-3 flex flex-col items-center text-center gap-4 py-2">
        {state.status === "waiting" && (
          <>
            <Spin size="large" />
            <Text>{tv("waiting")}</Text>
            <Button onClick={onCancel}>{tCommon("cancel")}</Button>
          </>
        )}

        {state.status === "matched" && (
          <>
            <Text type="secondary">{tv("detected")}</Text>
            <Title level={3} className="!m-0 !text-orange-600">Bs {state.amount.toFixed(2)}</Title>
            <Text>
              {tv("from")} <Text strong>{state.payerName}</Text>
            </Text>
            <Text type="secondary">{tv("isCustomer")}</Text>
            <div className="flex gap-2 w-full mt-2">
              <Button icon={<CloseOutlined />} onClick={onReject} style={{ flex: 1 }}>
                {tv("update")}
              </Button>
              <Button type="primary" icon={<CheckOutlined />} onClick={onConfirm} style={{ flex: 1, background: "#16a34a", borderColor: "#16a34a" }}>
                {tv("sold")}
              </Button>
            </div>
          </>
        )}

        {state.status === "timedOut" && (
          <>
            <Text>{tv("notDetected")}</Text>
            <div className="flex gap-2 w-full mt-2">
              <Button onClick={onCancel} style={{ flex: 1 }}>{tCommon("cancel")}</Button>
              <Button type="primary" onClick={onConfirm} style={{ flex: 1, background: "#ea580c", borderColor: "#ea580c" }}>
                {t("confirmAndCharge")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

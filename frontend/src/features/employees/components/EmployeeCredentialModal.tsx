"use client";

import { Modal, Typography, Button, message } from "antd";
import { CopyOutlined, PrinterOutlined, ShareAltOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import type { EmployeeCredential } from "../types/employee.types";

const { Text } = Typography;

interface Props {
  credential: EmployeeCredential | null;
  onClose: () => void;
}

export function EmployeeCredentialModal({ credential, onClose }: Props) {
  const t = useTranslations("employees.credentialModal");
  const canShare = typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;

  const handleCopyCode = async () => {
    if (!credential) return;
    await navigator.clipboard.writeText(credential.manual_code);
    message.success(t("copyCodeSuccess"));
  };

  const handlePrint = () => window.print();

  // Copia digital de respaldo: si el empleado se olvida la tarjeta impresa
  // pero guarda esta imagen en su celular, puede mostrarla en pantalla para
  // que OTRO celular la escanee (mismo mecanismo que un ticket digital).
  const handleShare = async () => {
    if (!credential) return;
    try {
      const blob = await (await fetch(credential.qr_image_data_url)).blob();
      const file = new File([blob], "credencial-qr.png", { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: t("shareTitle") });
      }
    } catch {
      // El usuario canceló el share o el navegador lo rechazó — no es un error real.
    }
  };

  return (
    <Modal
      title={t("title")}
      open={!!credential}
      onOk={onClose}
      onCancel={onClose}
      okText={t("gotIt")}
      cancelButtonProps={{ style: { display: "none" } }}
      closable={false}
      maskClosable={false}
    >
      <Text type="warning" strong style={{ display: "block", marginBottom: 16 }}>
        {t("warning")}
      </Text>

      {credential && (
        <div id="employee-credential-print" style={{ textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={credential.qr_image_data_url} alt="Credencial QR" style={{ width: 200, height: 200 }} />

          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ display: "block", fontSize: 12 }}>{t("backupCodeLabel")}</Text>
            <Text strong style={{ fontSize: 28, letterSpacing: 4, fontFamily: "monospace" }}>{credential.manual_code}</Text>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
        <Button icon={<CopyOutlined />} onClick={handleCopyCode}>{t("copyCode")}</Button>
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>{t("print")}</Button>
        {credential && (
          <Button href={credential.qr_image_data_url} download="credencial-qr.png">
            {t("downloadQr")}
          </Button>
        )}
        {canShare && (
          <Button icon={<ShareAltOutlined />} onClick={handleShare}>{t("share")}</Button>
        )}
      </div>
    </Modal>
  );
}

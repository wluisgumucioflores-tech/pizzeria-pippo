"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Alert, Button, Input, Modal, Space, Typography, message } from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import {
  buildOrderUrl,
  isUnreachableForCustomers,
  resolvePublicBaseUrl,
} from "../lib/public-url";
import { QR_IMAGE_SIZE, generateQrDataUrl } from "../lib/qr";

const { Text } = Typography;

interface Props {
  branch: { id: string; name: string } | null;
  onClose: () => void;
}

export function BranchQrModal({ branch, onClose }: Props) {
  const t = useTranslations("onlineOrders.qr");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [unreachable, setUnreachable] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!branch) {
      setDataUrl(null);
      return;
    }

    // window.location is only available client-side, which is why this lives
    // in an effect and not in a derived value.
    const baseUrl = resolvePublicBaseUrl(
      process.env.NEXT_PUBLIC_PUBLIC_BASE_URL,
      window.location.origin,
    );
    const orderUrl = buildOrderUrl(baseUrl, branch.id);
    setUrl(orderUrl);
    setUnreachable(isUnreachableForCustomers(baseUrl));
    setFailed(false);

    let active = true;
    generateQrDataUrl(orderUrl)
      .then((png) => {
        if (active) setDataUrl(png);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [branch]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      message.success(t("copied"));
    } catch {
      // Clipboard is blocked outside HTTPS in some browsers — the URL is
      // visible in the field, so the admin can still select it by hand.
      message.warning(t("copyFailed"));
    }
  };

  const download = () => {
    if (!dataUrl || !branch) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    // Slug-ish filename so several branches' QRs don't overwrite each other.
    link.download = `qr-${branch.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  };

  return (
    <Modal
      open={branch !== null}
      centered
      onCancel={onClose}
      title={t("title", { branch: branch?.name ?? "" })}
      footer={[
        <Button key="close" onClick={onClose}>
          {t("close")}
        </Button>,
        <Button
          key="download"
          type="primary"
          icon={<DownloadOutlined />}
          disabled={!dataUrl}
          onClick={download}
        >
          {t("download")}
        </Button>,
      ]}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        {t("hint")}
      </Text>

      {unreachable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={t("unreachableTitle")}
          description={t("unreachableBody")}
        />
      )}

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        {failed ? (
          <Text type="danger">{t("generateFailed")}</Text>
        ) : dataUrl ? (
          <Image
            src={dataUrl}
            alt={t("title", { branch: branch?.name ?? "" })}
            width={QR_IMAGE_SIZE}
            height={QR_IMAGE_SIZE}
            unoptimized
            style={{ maxWidth: "100%", height: "auto" }}
          />
        ) : (
          <Text type="secondary">{t("generating")}</Text>
        )}
      </div>

      <Space.Compact style={{ width: "100%" }}>
        <Input readOnly value={url} />
        <Button icon={<CopyOutlined />} onClick={copyUrl}>
          {t("copy")}
        </Button>
      </Space.Compact>
    </Modal>
  );
}

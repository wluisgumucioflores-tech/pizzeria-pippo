"use client";

import { Input, Button, Spin, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useAttendanceScan } from "@/features/attendance/hooks/useAttendanceScan";

const { Title, Text } = Typography;

export default function FicharPage() {
  const t = useTranslations("attendance.scan");
  const { status, message, resultType, manualCode, setManualCode, submitManualCode } = useAttendanceScan();
  const isSalida = resultType === "salida";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <Title level={3} style={{ color: "#ea580c" }}>Pizzería Pippo</Title>

        {status === "loading" && (
          <div style={{ marginTop: 24 }}>
            <Spin size="large" />
            <Text style={{ display: "block", marginTop: 16 }}>{t("registering")}</Text>
          </div>
        )}

        {status === "success" && (
          <div
            style={{
              marginTop: 24,
              background: isSalida ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${isSalida ? "#fecaca" : "#bbf7d0"}`,
              borderRadius: 12,
              padding: 24,
            }}
          >
            <Text strong style={{ fontSize: 18, color: isSalida ? "#dc2626" : "#16a34a" }}>{message}</Text>
          </div>
        )}

        {status === "error" && (
          <div style={{ marginTop: 24, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24 }}>
            <Text strong style={{ color: "#dc2626" }}>{message}</Text>
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <div style={{ marginTop: 24 }}>
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              {t("manualCodeHint")}
            </Text>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onPressEnter={submitManualCode}
                placeholder={t("codePlaceholder")}
                size="large"
                maxLength={6}
              />
              <Button type="primary" size="large" onClick={submitManualCode} style={{ background: "#ea580c", borderColor: "#ea580c" }}>
                {t("register")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

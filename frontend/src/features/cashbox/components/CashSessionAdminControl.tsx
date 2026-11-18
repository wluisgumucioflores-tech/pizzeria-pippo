"use client";

import { Alert, Button, Card, Space, Tag, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useCashSession } from "../hooks/useCashSession";
import { OpenCashModal } from "./OpenCashModal";
import { RegisterExpenseModal } from "./RegisterExpenseModal";
import { CloseCashModal } from "./CloseCashModal";

const { Text } = Typography;

interface Props {
  /** "all" (ningún filtro de sucursal elegido en Reportes) deshabilita los controles. */
  branchId: string;
  branchLabel?: string;
  onChanged: () => void;
}

// Mismas acciones que el widget del POS (abrir/gasto/cerrar), pero para que
// el admin pueda operar la caja de una sucursal sin estar físicamente en el
// POS — por ejemplo, cerrar un turno que el cajero se olvidó. Como pega
// contra la misma sesión del backend, lo que hace el admin acá se refleja
// de inmediato en el POS de esa sucursal (y viceversa).
export function CashSessionAdminControl({ branchId, branchLabel, onChanged }: Props) {
  const t = useTranslations("cashbox.adminControl");
  const cash = useCashSession(branchId !== "all" ? branchId : undefined, true, onChanged);

  if (branchId === "all") {
    return <Alert type="info" showIcon message={t("pickBranch")} style={{ marginBottom: 16 }} />;
  }

  return (
    <Card size="small" style={{ marginBottom: 16 }} loading={cash.loading}>
      <Space align="center" wrap>
        <Text strong>{branchLabel}</Text>
        {cash.session ? (
          <>
            <Tag color="green">{t("openTag")} · Bs {cash.session.opening_amount.toFixed(2)}</Tag>
            <Button size="small" onClick={() => cash.setExpenseModalOpen(true)}>
              {t("expenseButton")}
            </Button>
            <Button size="small" danger onClick={cash.openCloseModal}>
              {t("closeButton")}
            </Button>
          </>
        ) : (
          <Button size="small" type="primary" onClick={() => cash.setOpenModalOpen(true)}>
            {t("openButton")}
          </Button>
        )}
      </Space>

      <OpenCashModal
        open={cash.openModalOpen}
        saving={cash.saving}
        error={cash.error}
        onConfirm={cash.openSession}
        onClose={() => { cash.setOpenModalOpen(false); cash.dismissError(); }}
      />
      <RegisterExpenseModal
        open={cash.expenseModalOpen}
        saving={cash.saving}
        error={cash.error}
        onConfirm={cash.addExpense}
        onClose={() => { cash.setExpenseModalOpen(false); cash.dismissError(); }}
      />
      <CloseCashModal
        open={cash.closeModalOpen}
        saving={cash.saving}
        error={cash.error}
        session={cash.session}
        onConfirm={cash.closeSession}
        onClose={() => { cash.setCloseModalOpen(false); cash.dismissError(); }}
      />
    </Card>
  );
}

"use client";

import { Modal, Form, InputNumber, Input, Button } from "antd";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import type { WarehouseRow } from "../types/warehouse.types";

interface AdjustModalProps {
  adjustingRow: WarehouseRow | null;
  form: FormInstance;
  loading: boolean;
  onSubmit: (values: { real_quantity: number; notes: string }) => void;
  onClose: () => void;
}

export function WarehouseAdjustModal({ adjustingRow, form, loading, onSubmit, onClose }: AdjustModalProps) {
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");

  return (
    <Modal
      title={tw("adjustModalTitle", { name: adjustingRow?.ingredient_name ?? "" })}
      open={!!adjustingRow}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
        <Form.Item
          label={tw("realQuantity", { unit: adjustingRow?.unit ?? "" })}
          name="real_quantity"
          rules={[{ required: true, message: tw("required") }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item
          label={tw("adjustReason")}
          name="notes"
          rules={[{ required: true, message: tw("adjustReasonRequired") }]}
        >
          <Input placeholder={tw("adjustReasonPlaceholder")} />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={loading}>{t("save")}</Button>
        </div>
      </Form>
    </Modal>
  );
}

interface MinQtyModalProps {
  editingRow: WarehouseRow | null;
  form: FormInstance;
  onSubmit: (values: { min_quantity: number }) => void;
  onClose: () => void;
}

export function WarehouseMinQtyModal({ editingRow, form, onSubmit, onClose }: MinQtyModalProps) {
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");

  return (
    <Modal
      title={tw("minQtyModalTitle", { name: editingRow?.ingredient_name ?? "" })}
      open={!!editingRow}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
        <Form.Item
          label={tw("minQuantityLabel", { unit: editingRow?.unit ?? "" })}
          name="min_quantity"
          rules={[{ required: true, message: tw("required") }]}
        >
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit">{t("save")}</Button>
        </div>
      </Form>
    </Modal>
  );
}

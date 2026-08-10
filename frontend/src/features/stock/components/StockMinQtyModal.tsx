"use client";

import { Modal, Form, InputNumber, Button, Typography } from "antd";
import { useTranslations } from "next-intl";
import type { FormInstance } from "antd";
import type { StockRow, ProductStockRow } from "../types/stock.types";

const { Text } = Typography;

interface Props {
  open: boolean;
  editingStock: StockRow | null;
  productStock?: ProductStockRow | null;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { min_quantity: number }) => void;
}

export function StockMinQtyModal({ open, editingStock, productStock, form, onClose, onSubmit }: Props) {
  const t = useTranslations("common");
  const tm = useTranslations("stock.minQtyModal");
  const isProduct = !!productStock;
  const productName = productStock?.product_variants?.products?.name ?? "";
  const variantName = productStock?.product_variants?.name;
  const name = isProduct
    ? `${productName}${variantName && variantName !== "Unidad" ? ` — ${variantName}` : ""}`
    : (editingStock?.ingredients?.name ?? "");
  const title = tm("title", { name });

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
        <Text type="secondary" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
          {isProduct ? tm("helperProduct") : tm("helperIngredient")}
        </Text>
        <Form.Item label={tm("label")} name="min_quantity" rules={[{ required: true, message: tm("required") }]}>
          <InputNumber min={0} style={{ width: "100%" }} addonAfter={isProduct ? tm("unitsSuffix") : undefined} />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit">{t("save")}</Button>
        </div>
      </Form>
    </Modal>
  );
}

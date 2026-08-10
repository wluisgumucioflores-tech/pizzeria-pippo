"use client";

import { useRouter } from "next/navigation";
import { Form, Select, InputNumber, Input, Button, Typography, Space, Alert, Radio } from "antd";
import { useTranslations } from "next-intl";
import { useWarehousePurchase } from "@/features/warehouse/hooks/useWarehousePurchase";

const { Title, Text } = Typography;

const IconCart = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

export default function WarehousePurchasePage() {
  const router = useRouter();
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");
  const tp = useTranslations("warehouse.purchase");
  const {
    form, purchaseType, ingredients, variants,
    selectedUnit, currentStock, loading, error, success,
    setError, handleTypeChange, handleIngredientChange, handleVariantChange, handleSubmit,
  } = useWarehousePurchase();

  const isIngredient = purchaseType === "ingredient";

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <Space style={{ marginBottom: 20 }}>
        <Button icon={<IconArrowLeft />} type="text" onClick={() => router.push("/warehouse")}>{t("back")}</Button>
      </Space>

      <Title level={4} style={{ marginBottom: 20 }}>{tp("title")}</Title>

      <Radio.Group value={purchaseType} onChange={(e) => handleTypeChange(e.target.value)}
        optionType="button" buttonStyle="solid" style={{ marginBottom: 24 }}>
        <Radio.Button value="ingredient">{tw("tabIngredients")}</Radio.Button>
        <Radio.Button value="product">{tw("tabProducts")}</Radio.Button>
      </Radio.Group>

      {success && <Alert type="success" message={tp("success")} style={{ marginBottom: 16 }} showIcon />}
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon closable onClose={() => setError(null)} />}

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {isIngredient ? (
          <Form.Item label={tp("ingredientLabel")} name="ingredient_id" rules={[{ required: true, message: tp("ingredientRequired") }]}>
            <Select showSearch placeholder={tp("ingredientPlaceholder")} onChange={handleIngredientChange}
              options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        ) : (
          <Form.Item label={tp("productLabel")} name="variant_id" rules={[{ required: true, message: tp("productRequired") }]}>
            <Select showSearch placeholder={tp("productPlaceholder")} onChange={handleVariantChange}
              options={variants.map((v) => ({
                value: v.id,
                label: v.name === "Unidad" ? (v.products?.name ?? v.id) : `${v.products?.name ?? ""} — ${v.name}`,
              }))}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        )}

        {currentStock !== null && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>
            {tp("currentStock")}<Text strong style={{ color: "#16a34a" }}>{currentStock} {selectedUnit}</Text>
          </div>
        )}

        <Form.Item label={`${tp("quantityLabel")}${selectedUnit ? ` (${selectedUnit})` : ""}`} name="quantity"
          rules={[
            { required: true, message: tp("quantityRequired") },
            { type: "number", min: 0.001, message: tp("quantityMin") },
          ]}>
          <InputNumber style={{ width: "100%" }} placeholder={isIngredient ? tp("quantityPlaceholderIngredient") : tp("quantityPlaceholderProduct")} addonAfter={selectedUnit || undefined} />
        </Form.Item>

        <Form.Item label={`${tp("minQuantityLabel")}${selectedUnit ? ` (${selectedUnit})` : ""}`} name="min_quantity"
          tooltip={tp("minQuantityTooltip")}
          rules={[{ required: true, message: tp("minQuantityRequired") }]}>
          <InputNumber min={0} style={{ width: "100%" }} placeholder={tp("minQuantityPlaceholder")} addonAfter={selectedUnit || undefined} />
        </Form.Item>

        <Form.Item label={tp("notes")} name="notes">
          <Input.TextArea rows={2} placeholder={tp("notesPlaceholder")} />
        </Form.Item>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => router.push("/warehouse")}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<IconCart />}>{tp("submit")}</Button>
        </div>
      </Form>
    </div>
  );
}

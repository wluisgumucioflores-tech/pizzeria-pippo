"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Form, Select, InputNumber, Input, Button, Typography, Space, Alert, Radio } from "antd";
import { useTranslations } from "next-intl";
import { useWarehouseTransfer } from "@/features/warehouse/hooks/useWarehouseTransfer";

const { Title, Text } = Typography;

const IconSwap = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg className="inline w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);

export default function WarehouseTransferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedIngredient = searchParams.get("ingredientId");
  const preselectedVariant = searchParams.get("variantId");
  const t = useTranslations("common");
  const tw = useTranslations("warehouse");
  const tt = useTranslations("warehouse.transferPage");

  const {
    form, transferType, ingredients, branches, variants,
    available, selectedUnit, loading, error, success,
    setError, handleTypeChange, handleIngredientChange, handleVariantChange, handleSubmit,
  } = useWarehouseTransfer(preselectedIngredient, preselectedVariant);

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <Space style={{ marginBottom: 20 }}>
        <Button icon={<IconArrowLeft />} type="text" onClick={() => router.push("/warehouse")}>{t("back")}</Button>
      </Space>

      <Title level={4} style={{ marginBottom: 20 }}>{tt("title")}</Title>

      <Radio.Group value={transferType} onChange={(e) => handleTypeChange(e.target.value)}
        optionType="button" buttonStyle="solid" style={{ marginBottom: 24 }}>
        <Radio.Button value="ingredient">{tw("tabIngredients")}</Radio.Button>
        <Radio.Button value="product">{tw("tabProducts")}</Radio.Button>
      </Radio.Group>

      {success && <Alert type="success" message={tt("success")} style={{ marginBottom: 16 }} showIcon />}
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon closable onClose={() => setError(null)} />}

      <Form form={form} layout="vertical" onFinish={(values) => handleSubmit(values, () => router.push("/warehouse"))}>
        {transferType === "ingredient" ? (
          <Form.Item label={tw("purchase.ingredientLabel")} name="ingredient_id" rules={[{ required: true, message: tw("purchase.ingredientRequired") }]}>
            <Select showSearch placeholder={tw("purchase.ingredientPlaceholder")} onChange={handleIngredientChange}
              options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        ) : (
          <Form.Item label={tw("purchase.productLabel")} name="variant_id" rules={[{ required: true, message: tw("purchase.productRequired") }]}>
            <Select showSearch placeholder={tw("purchase.productPlaceholder")} onChange={handleVariantChange}
              options={variants.map((v) => ({
                value: v.id,
                label: v.name === "Unidad" ? (v.products?.name ?? v.id) : `${v.products?.name ?? ""} — ${v.name}`,
              }))}
              filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        )}

        {available !== null && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 14 }}>
            {tt("available")}<Text strong style={{ color: available === 0 ? "#ef4444" : "#16a34a" }}>{available} {selectedUnit}</Text>
          </div>
        )}

        <Form.Item label={`${tt("quantityLabel")}${selectedUnit ? ` (${selectedUnit})` : ""}`} name="quantity"
          rules={[{ required: true, message: tt("quantityRequired") }]}>
          <InputNumber min={0.001} max={available ?? undefined} style={{ width: "100%" }} placeholder={tt("quantityPlaceholder")} addonAfter={selectedUnit || undefined} />
        </Form.Item>

        <Form.Item label={tt("destinationLabel")} name="branch_id" rules={[{ required: true, message: tt("destinationRequired") }]}>
          <Select placeholder={tt("destinationPlaceholder")} options={branches.map((b) => ({ value: b.id, label: b.name }))} />
        </Form.Item>

        <Form.Item label={tt("notes")} name="notes">
          <Input.TextArea rows={2} placeholder={tt("notesPlaceholder")} />
        </Form.Item>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => router.push("/warehouse")}>{t("cancel")}</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<IconSwap />}>{tt("submit")}</Button>
        </div>
      </Form>
    </div>
  );
}

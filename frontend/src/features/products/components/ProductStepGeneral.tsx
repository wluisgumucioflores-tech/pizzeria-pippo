"use client";

import { Form, Input, Select, Button, Upload, Typography, Row, Col } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import { useTranslations } from "next-intl";
import { getCategoryOptions } from "../constants/product.constants";
import { ProductImage } from "./ProductImage";
import type { Step1Data, ProductType } from "../types/product.types";

const { TextArea } = Input;
const { Text } = Typography;
const { useWatch } = Form;

interface Props {
  form: FormInstance;
  uploading: boolean;
  imageUrl: string;
  step1Data: Step1Data;
  onImageUpload: (file: File) => Promise<boolean>;
  onNext: () => void;
}

export function ProductStepGeneral({ form, uploading, imageUrl, step1Data, onImageUpload, onNext }: Props) {
  const selectedProductType = useWatch("product_type", form);
  const t = useTranslations("products");
  const tf = useTranslations("products.form");
  const CATEGORY_OPTIONS = getCategoryOptions(t);
  const PRODUCT_TYPE_OPTIONS: { value: ProductType; icon: string; label: string; description: string }[] = [
    { value: "made", icon: "🍳", label: tf("madeLabel"), description: tf("madeDesc") },
    { value: "resale", icon: "📦", label: tf("resaleLabel"), description: tf("resaleDesc") },
  ];

  return (
    <Form form={form} layout="vertical">
      <Row gutter={24}>
        {/* Left column */}
        <Col span={14}>
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item label={t("name")} name="name" rules={[{ required: true, message: tf("required") }]}>
                <Input placeholder={tf("namePlaceholder")} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label={t("category")} name="category" rules={[{ required: true, message: tf("required") }]}>
                <Select options={CATEGORY_OPTIONS} placeholder={tf("categoryPlaceholder")} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={tf("howMade")}
            name="product_type"
            rules={[{ required: true, message: tf("howMadeRequired") }]}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {PRODUCT_TYPE_OPTIONS.map((opt) => {
                const selected = selectedProductType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => form.setFieldValue("product_type", opt.value)}
                    style={{
                      flex: 1, padding: "12px 10px", borderRadius: 10, cursor: "pointer",
                      border: `2px solid ${selected ? "#ea580c" : "#e5e7eb"}`,
                      background: selected ? "#fff7ed" : "#fff",
                      textAlign: "center", transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 2 }}>{opt.icon}</div>
                    <Text strong style={{ fontSize: 12, color: selected ? "#ea580c" : "#374151", display: "block" }}>
                      {opt.label}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{opt.description}</Text>
                  </button>
                );
              })}
            </div>
          </Form.Item>

          <Form.Item label={t("descriptionForCustomer")} name="description">
            <TextArea rows={3} placeholder={tf("descriptionPlaceholder")} />
          </Form.Item>
        </Col>

        {/* Right column — image */}
        <Col span={10}>
          <Form.Item label={t("image")}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb", minHeight: 200 }}>
              <ProductImage url={imageUrl} category={step1Data.category} width={140} height={140} />
              <Upload beforeUpload={onImageUpload} showUploadList={false} accept="image/*">
                <Button icon={<UploadOutlined />} loading={uploading}>
                  {uploading ? tf("uploading") : tf("uploadImage")}
                </Button>
              </Upload>
            </div>
          </Form.Item>
        </Col>
      </Row>

      <div className="flex justify-end mt-2">
        <Button type="primary" onClick={onNext}>
          {tf("next")}
        </Button>
      </div>
    </Form>
  );
}

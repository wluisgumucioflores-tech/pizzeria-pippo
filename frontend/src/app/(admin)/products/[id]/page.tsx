"use client";

import { useParams, useRouter } from "next/navigation";
import { Row, Col, Tag, Typography, Space, Button, Skeleton } from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { useProductDetail } from "@/features/products/hooks/useProductDetail";
import { ProductImageCard } from "@/features/products/components/ProductImageCard";
import { ProductVariantsList } from "@/features/products/components/ProductVariantsList";

const { Title, Text } = Typography;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { product, loading } = useProductDetail(id);
  const t = useTranslations("common");
  const tp = useTranslations("products");

  if (loading) return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>;
  if (!product) return <div style={{ padding: 24 }}><Text type="danger">{tp("notFound")}</Text></div>;

  const imgSize = isMobile ? 140 : 220;

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/products")}>{t("back")}</Button>
          <Title level={4} style={{ margin: 0 }}>{product.name}</Title>
          {!product.is_active && <Tag color="default">{tp("inactiveTag")}</Tag>}
        </Space>
        <Button icon={<EditOutlined />} type="primary" onClick={() => router.push(`/products/${id}/edit`)}>{t("edit")}</Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <ProductImageCard
            name={product.name}
            category={product.category}
            imageUrl={product.image_url}
            description={product.description}
            isActive={product.is_active}
            imgSize={imgSize}
          />
        </Col>

        <Col xs={24} lg={16}>
          <ProductVariantsList variants={product.product_variants} isMobile={isMobile} />
        </Col>
      </Row>
    </div>
  );
}

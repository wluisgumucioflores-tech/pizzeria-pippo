"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Space, Typography } from "antd";
import { ArrowLeftOutlined, DollarOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { ProductsService } from "@/features/products/services/products.service";
import { useProductBranchPrices } from "@/features/products/hooks/useProductBranchPrices";
import { ProductBranchPricesView } from "@/features/products/components/ProductBranchPricesView";

const { Title, Text } = Typography;

export default function ProductBranchPricesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const t = useTranslations("products.branchPricesPage");

  const { variants, branches, isLoading, saving, savePrice } = useProductBranchPrices(id);

  useEffect(() => {
    ProductsService.getProductName(id).then((name) => { if (name) setProductName(name); });
  }, [id]);

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Space style={{ marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/products")}>
          {t("back")}
        </Button>
      </Space>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <DollarOutlined style={{ fontSize: 22, color: "#ea580c" }} />
        <div>
          <Title level={4} style={{ margin: 0 }}>{productName || t("loading")}</Title>
          <Text type="secondary">{t("subtitle")}</Text>
        </div>
      </div>

      <Card>
        <ProductBranchPricesView
          productName={productName}
          variants={variants}
          branches={branches}
          isLoading={isLoading}
          saving={saving}
          onSave={savePrice}
        />
      </Card>
    </div>
  );
}

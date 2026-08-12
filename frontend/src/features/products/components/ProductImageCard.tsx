"use client";

import Image from "next/image";
import { Card, Space, Typography, Tag, Badge, Divider } from "antd";
import { useTranslations } from "next-intl";

const { Title, Text } = Typography;

const CATEGORY_COLORS: Record<string, string> = { pizza: "red", bebida: "blue", otro: "green" };
const CATEGORY_BG: Record<string, string> = { pizza: "#fef2f2", bebida: "#eff6ff", otro: "#f0fdf4" };
const CATEGORY_EMOJI: Record<string, string> = { pizza: "🍕", bebida: "🥤", otro: "🍽️" };

function CategoryPlaceholder({ category, size = 220 }: { category: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: CATEGORY_BG[category] ?? "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: size * 0.35, lineHeight: 1 }}>{CATEGORY_EMOJI[category] ?? "🍽️"}</span>
    </div>
  );
}

interface Props {
  name: string;
  category: string;
  imageUrl: string;
  description: string;
  isActive: boolean;
  imgSize: number;
}

export function ProductImageCard({ name, category, imageUrl, description, isActive, imgSize }: Props) {
  const t = useTranslations("products");

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={imgSize} height={imgSize} unoptimized style={{ borderRadius: 12, objectFit: "cover" }} />
        ) : (
          <CategoryPlaceholder category={category} size={imgSize} />
        )}
        <div style={{ textAlign: "center" }}>
          <Title level={3} style={{ margin: 0 }}>{name}</Title>
          <Space style={{ marginTop: 8 }}>
            <Tag color={CATEGORY_COLORS[category] ?? "default"} style={{ fontSize: 13 }}>{category}</Tag>
            {isActive ? <Badge status="success" text={t("activeBadge")} /> : <Badge status="default" text={t("inactiveTag")} />}
          </Space>
        </div>
      </div>
      {description && (
        <>
          <Divider />
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>{t("descriptionForCustomer")}</Text>
            <Text>{description}</Text>
          </div>
        </>
      )}
    </Card>
  );
}

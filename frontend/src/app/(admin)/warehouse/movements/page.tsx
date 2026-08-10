"use client";

import { useRouter } from "next/navigation";
import { Typography, Space, Button } from "antd";
import { ArrowLeftOutlined, HistoryOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/lib/useIsMobile";
import { useWarehouseMovements } from "@/features/warehouse/hooks/useWarehouseMovements";
import { WarehouseMovementsFilters } from "@/features/warehouse/components/WarehouseMovementsFilters";
import { WarehouseMovementsTable } from "@/features/warehouse/components/WarehouseMovementsTable";
import { WarehouseMovementsMobileList } from "@/features/warehouse/components/WarehouseMovementsMobileList";

const { Title } = Typography;

export default function WarehouseMovementsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const t = useTranslations("common");
  const tw = useTranslations("warehouse.movements");
  const {
    movements, ingredients, branches, loading,
    filterType, setFilterType,
    filterIngredient, setFilterIngredient,
    filterBranch, setFilterBranch,
    filterDates, setFilterDates,
    filterOrigin, setFilterOrigin,
  } = useWarehouseMovements();

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => router.push("/warehouse")}>
          {t("back")}
        </Button>
      </Space>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <HistoryOutlined style={{ fontSize: 18 }} />
        <Title level={4} style={{ margin: 0 }}>{tw("title")}</Title>
      </div>

      <WarehouseMovementsFilters
        filterOrigin={filterOrigin}
        onFilterOriginChange={setFilterOrigin}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterIngredient={filterIngredient}
        onFilterIngredientChange={setFilterIngredient}
        ingredients={ingredients}
        filterBranch={filterBranch}
        onFilterBranchChange={setFilterBranch}
        branches={branches}
        filterDates={filterDates}
        onFilterDatesChange={setFilterDates}
      />

      {isMobile
        ? <WarehouseMovementsMobileList movements={movements} loading={loading} />
        : <WarehouseMovementsTable movements={movements} loading={loading} />}
    </div>
  );
}

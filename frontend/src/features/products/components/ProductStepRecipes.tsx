"use client";

import { Button, Select, InputNumber, Typography } from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useIngredientSearch } from "../hooks/useIngredientSearch";
import type { Variant, RecipeItem, Ingredient } from "../types/product.types";

const { Text } = Typography;

interface Props {
  variants: Variant[];
  saving: boolean;
  editing: boolean;
  onAddRecipeItem: (variantIndex: number, ingredient?: Ingredient) => void;
  onUpdateRecipeItem: (variantIndex: number, recipeIndex: number, field: keyof RecipeItem, value: string | number) => void;
  onRemoveRecipeItem: (variantIndex: number, recipeIndex: number) => void;
  onPrev: () => void;
  onSave: () => void;
}

// Este paso solo se muestra cuando el producto es "elaboración propia"
// (ver ProductFormPage: isMade && currentStep === 2) — no hace falta
// preguntar de nuevo si usa ingredientes, ya se eligió en el paso 1.
export function ProductStepRecipes({
  variants, saving, editing,
  onAddRecipeItem, onUpdateRecipeItem, onRemoveRecipeItem,
  onPrev, onSave,
}: Props) {
  const tf = useTranslations("products.form");

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginBottom: 12 }}>
        {variants.map((variant, vi) => (
          <VariantRecipeCard
            key={vi}
            variant={variant}
            variantIndex={vi}
            onAddRecipeItem={onAddRecipeItem}
            onUpdateRecipeItem={onUpdateRecipeItem}
            onRemoveRecipeItem={onRemoveRecipeItem}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <Button onClick={onPrev}>{tf("previous")}</Button>
        <Button type="primary" onClick={onSave} loading={saving} disabled={saving}>
          {editing ? tf("saveChanges") : tf("createProduct")}
        </Button>
      </div>
    </div>
  );
}

interface CardProps {
  variant: Variant;
  variantIndex: number;
  onAddRecipeItem: (variantIndex: number, ingredient?: Ingredient) => void;
  onUpdateRecipeItem: (variantIndex: number, recipeIndex: number, field: keyof RecipeItem, value: string | number) => void;
  onRemoveRecipeItem: (variantIndex: number, recipeIndex: number) => void;
}

function VariantRecipeCard({ variant, variantIndex, onAddRecipeItem, onUpdateRecipeItem, onRemoveRecipeItem }: CardProps) {
  const usedIngredientIds = variant.recipes.map((r) => r.ingredient_id);
  const { options, loading, search } = useIngredientSearch();
  const t = useTranslations("products");
  const tf = useTranslations("products.form");
  const tc = useTranslations("products.variants.conditions");
  const CONDITION_OPTIONS = [
    { value: "always", label: tc("always") },
    { value: "takeaway", label: tc("takeaway") },
    { value: "dine_in", label: tc("dine_in") },
  ];

  const handleAddIngredient = (ingredientId: string | null) => {
    if (!ingredientId) return;
    const ingredient = options.find((i) => i.id === ingredientId);
    onAddRecipeItem(variantIndex, ingredient);
  };

  return (
    <div style={{ padding: "14px 16px", background: "#f9fafb", borderRadius: 10, border: "1px solid #e5e7eb" }}>
      {/* Card header */}
      <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #e5e7eb" }}>
        <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>{t("recipe.title")}</Text>
        <Text strong style={{ fontSize: 14, display: "block", color: "#c2410c" }}>{variant.name}</Text>
      </div>

      {/* Recipe rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {variant.recipes.length === 0 && (
          <Text type="secondary" style={{ fontSize: 12, fontStyle: "italic" }}>{tf("recipeNoIngredients")}</Text>
        )}
        {variant.recipes.map((recipe, ri) => (
          <div key={ri} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Text style={{ flex: 1, fontSize: 12, minWidth: 0, wordBreak: "break-word" }}>
              {recipe.ingredients ? `${recipe.ingredients.name} (${recipe.ingredients.unit})` : "—"}
            </Text>
            <InputNumber
              value={recipe.quantity}
              onChange={(val) => onUpdateRecipeItem(variantIndex, ri, "quantity", val ?? 0)}
              style={{ width: 70, flexShrink: 0 }}
              min={0}
              size="small"
            />
            <Select
              value={recipe.apply_condition ?? "always"}
              options={CONDITION_OPTIONS}
              onChange={(val) => onUpdateRecipeItem(variantIndex, ri, "apply_condition", val)}
              style={{ width: 110, flexShrink: 0 }}
              size="small"
            />
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onRemoveRecipeItem(variantIndex, ri)}
            />
          </div>
        ))}
      </div>

      {/* Add ingredient — server-side search, only the top 10 matches are ever loaded */}
      <Select
        placeholder={<><PlusOutlined style={{ marginRight: 4 }} />{tf("addIngredientPlaceholder")}</>}
        showSearch
        style={{ width: "100%" }}
        size="small"
        filterOption={false}
        loading={loading}
        notFoundContent={loading ? tf("searching") : tf("noResults")}
        onSearch={search}
        options={options
          .filter((i) => !usedIngredientIds.includes(i.id))
          .map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))}
        value={null}
        onChange={handleAddIngredient}
      />
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Steps, Button, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { ProductStepGeneral } from "./ProductStepGeneral";
import { ProductStepVariants } from "./ProductStepVariants";
import { ProductStepRecipes } from "./ProductStepRecipes";
import { useProductForm } from "../hooks/useProductForm";
import type { Product } from "../types/product.types";

const { Title } = Typography;

interface Props {
  editing?: Product;
}

export function ProductFormPage({ editing }: Props) {
  const router = useRouter();
  const t = useTranslations("common");
  const tp = useTranslations("products");
  const ts = useTranslations("products.steps");
  const form = useProductForm(() => router.push("/products"));
  const isMade = form.step1Data.product_type === "made";
  const stepsWithRecipes = [
    { title: ts("generalData") },
    { title: ts("variantsAndPrices") },
    { title: ts("recipes") },
  ];
  const stepsWithoutRecipes = [
    { title: ts("generalData") },
    { title: ts("variantsAndPrices") },
  ];
  const steps = isMade ? stepsWithRecipes : stepsWithoutRecipes;

  useEffect(() => {
    if (editing) {
      form.loadForEdit(editing);
    } else {
      form.resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/products")}>
          {t("back")}
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {editing ? ts("editTitle", { name: editing.name }) : tp("new")}
        </Title>
      </div>

      <Steps current={form.currentStep} items={steps} style={{ marginBottom: 32 }} />

      {form.currentStep === 0 && (
        <ProductStepGeneral
          form={form.formStep1}
          uploading={form.uploading}
          imageUrl={form.imageUrl}
          onImageUpload={form.handleImageUpload}
          onNext={() =>
            form.formStep1.validateFields().then((values) => {
              form.setStep1Data(values);
              form.setCurrentStep(1);
            })
          }
        />
      )}

      {form.currentStep === 1 && (
        <ProductStepVariants
          variants={form.variants}
          variantTypeOptions={form.variantTypeOptions}
          branches={form.branches}
          hasVariants={form.hasVariants}
          onToggleVariants={form.setHasVariants}
          onUpdateVariant={form.updateVariant}
          onUpdateVariantBranchPrice={form.updateVariantBranchPrice}
          onAddVariant={form.addVariant}
          onRemoveVariant={form.removeVariant}
          onReactivateVariant={form.reactivateVariant}
          onPrev={() => form.setCurrentStep(0)}
          onNext={() => (isMade ? form.setCurrentStep(2) : form.handleSave(editing ?? null))}
          nextLabel={isMade ? undefined : editing ? t("save") : t("create")}
          saving={!isMade ? form.saving : false}
        />
      )}

      {isMade && form.currentStep === 2 && (
        <ProductStepRecipes
          variants={form.variants}
          saving={form.saving}
          editing={!!editing}
          onAddRecipeItem={form.addRecipeItem}
          onUpdateRecipeItem={form.updateRecipeItem}
          onRemoveRecipeItem={form.removeRecipeItem}
          onPrev={() => form.setCurrentStep(1)}
          onSave={() => form.handleSave(editing ?? null)}
        />
      )}
    </div>
  );
}

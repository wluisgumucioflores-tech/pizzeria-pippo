"use client";

import { useState, useEffect } from "react";
import { Form, notification } from "antd";
import { mutate } from "swr";
import { getToken } from "@/lib/auth";
import { ProductsService } from "../services/products.service";
import { VariantTypesService } from "@/features/variant-types/services/variant-types.service";
import { useProductVariants } from "./useProductVariants";
import type { Product, Step1Data, VariantTypeOption, Branch, Variant } from "../types/product.types";

export function useProductForm(onSuccess: () => void) {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [step1Data, setStep1Data] = useState<Step1Data>({ name: "", category_id: null, description: "", product_type: "made" });
  const [variantTypeOptions, setVariantTypeOptions] = useState<VariantTypeOption[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [formStep1] = Form.useForm();

  const productVariants = useProductVariants(variantTypeOptions);

  useEffect(() => {
    const loadVariantTypes = async () => {
      const data = await VariantTypesService.getVariantTypes(true);
      const options = data.map((vt) => ({ value: vt.name, label: vt.name }));
      setVariantTypeOptions(options);
    };
    loadVariantTypes();
    ProductsService.getBranches().then(setBranches);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setCurrentStep(0);
    setImageUrl("");
    setStep1Data({ name: "", category_id: null, description: "", product_type: "made" });
    formStep1.resetFields();
    productVariants.resetVariants();
  };

  const loadForEdit = async (record: Product) => {
    setCurrentStep(0);
    setImageUrl(record.image_url ?? "");

    const data = await ProductsService.getVariantsWithDetails(record.id);
    const loadedVariants = data.map((v) => ({
      name: v.name,
      base_price: v.base_price,
      branch_prices: v.branch_prices ?? [],
      recipes: (v.recipes ?? []).map((r) => ({
        ingredient_id: r.ingredient_id,
        quantity: r.quantity,
        apply_condition: r.apply_condition ?? "always",
        ingredients: r.ingredients,
      })),
      is_active: v.is_active ?? true,
    }));

    const activeVariants = loadedVariants.filter((v) => v.is_active !== false);
    const anyHasRecipe = activeVariants.some((v) => v.recipes.length > 0);
    const productType: "made" | "resale" = record.product_type ?? (anyHasRecipe ? "made" : "resale");
    const isSimple = activeVariants.length === 1 && activeVariants[0].name === "Unidad";

    formStep1.setFieldsValue({
      name: record.name,
      category_id: record.category_id,
      description: record.description,
      product_type: productType,
    });

    setStep1Data({
      name: record.name,
      category_id: record.category_id,
      description: record.description ?? "",
      product_type: productType,
    });

    productVariants.loadVariants(loadedVariants, isSimple);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    const token = await getToken();
    const { url, error } = await ProductsService.uploadImage(file, token);
    if (url) {
      setImageUrl(url);
    } else {
      notification.error({ message: error ?? "Error al subir la imagen" });
    }
    setUploading(false);
    return false as const;
  };

  // Cualquier sucursal activa sin precio propio todavía usa el precio base como
  // default — evita que un producto "made" recién creado quede invisible en el
  // POS de una sucursal solo porque nadie visitó /products/[id]/prices.
  const fillMissingBranchPrices = (variants: Variant[]): Variant[] =>
    variants.map((v) => {
      const covered = new Set(v.branch_prices.map((bp) => bp.branch_id));
      const missing = branches.filter((b) => !covered.has(b.id)).map((b) => ({ branch_id: b.id, price: v.base_price }));
      return missing.length ? { ...v, branch_prices: [...v.branch_prices, ...missing] } : v;
    });

  const handleSave = async (editing: Product | null) => {
    setSaving(true);
    const variantsWithPrices = fillMissingBranchPrices(productVariants.variants);
    const payload = ProductsService.buildPayload(step1Data, imageUrl, variantsWithPrices);
    const result = editing
      ? await ProductsService.updateProduct(editing.id, payload)
      : await ProductsService.createProduct(payload);
    setSaving(false);
    if (result.ok) {
      // Invalidates any cached page/filter of the products list
      // (navigating back to /products remounts the hook with the same swrKey,
      // and SWR serves the cache without refetching if dedupingInterval hasn't passed).
      mutate((key) => Array.isArray(key) && key[0] === "products");
      onSuccess();
    } else {
      notification.error({ message: result.error });
    }
  };

  return {
    currentStep, setCurrentStep,
    uploading, saving,
    imageUrl,
    step1Data, setStep1Data,
    variants: productVariants.variants, variantTypeOptions,
    branches,
    hasVariants: productVariants.hasVariants, setHasVariants: productVariants.setHasVariants,
    formStep1,
    resetForm, loadForEdit,
    handleImageUpload, handleSave,
    updateVariant: productVariants.updateVariant,
    updateVariantBranchPrice: productVariants.updateVariantBranchPrice,
    addVariant: productVariants.addVariant,
    removeVariant: productVariants.removeVariant,
    reactivateVariant: productVariants.reactivateVariant,
    addRecipeItem: productVariants.addRecipeItem,
    updateRecipeItem: productVariants.updateRecipeItem,
    removeRecipeItem: productVariants.removeRecipeItem,
  };
}

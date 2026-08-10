"use client";

import { Collapse, InputNumber, Typography } from "antd";
import type { FocusEvent } from "react";
import { useTranslations } from "next-intl";
import type { Branch, BranchPrice } from "../types/product.types";

const { Text } = Typography;

interface Props {
  branches: Branch[];
  basePrice: number;
  branchPrices: BranchPrice[];
  onChange: (branchId: string, price: number) => void;
}

// Selecciona todo el texto al enfocar: sin esto, escribir sobre un campo en 0
// inserta el dígito antes del 0 (ej. tipear "5" deja "05") en vez de reemplazarlo.
function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

// Cada fila muestra el override guardado o, si no hay uno, el precio base como
// default visual — recién al guardar el form se persiste ese default (ver
// fillMissingBranchPrices en useProductForm), así que no tocar nada acá sigue
// dejando el producto visible en el POS de todas las sucursales.
export function VariantBranchPrices({ branches, basePrice, branchPrices, onChange }: Props) {
  const tf = useTranslations("products.form");
  if (branches.length === 0) return null;

  return (
    <Collapse
      size="small"
      style={{ marginTop: 10 }}
      items={[
        {
          key: "branch-prices",
          label: tf("branchPricesCollapse", { count: branches.length }),
          children: (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {branches.map((branch) => {
                const override = branchPrices.find((bp) => bp.branch_id === branch.id);
                return (
                  <div key={branch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ fontSize: 13 }}>{branch.name}</Text>
                    <InputNumber
                      prefix="Bs"
                      size="small"
                      value={override?.price ?? basePrice}
                      onChange={(val) => onChange(branch.id, val ?? 0)}
                      onFocus={selectOnFocus}
                      style={{ width: 120 }}
                      min={0}
                    />
                  </div>
                );
              })}
            </div>
          ),
        },
      ]}
    />
  );
}

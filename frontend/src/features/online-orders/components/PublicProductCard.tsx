"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { formatMoney } from "../lib/money";
import { QtyStepper } from "./QtyStepper";
import type {
  PublicMenuProduct,
  PublicMenuVariant,
} from "../types/online-orders.types";

interface Props {
  product: PublicMenuProduct;
  /** Quantity already in the cart, per variant id. */
  qtyByVariant: Map<string, number>;
  /** True when the order hit its distinct-line cap — the + is then disabled for new lines. */
  cartFull: boolean;
  onAdd: (product: PublicMenuProduct, variant: PublicMenuVariant) => void;
  onChangeQty: (variantId: string, qty: number) => void;
}

export function PublicProductCard({ product, qtyByVariant, cartFull, onAdd, onChangeQty }: Props) {
  const t = useTranslations("onlineOrders");
  // A product photo that 404s would render as a broken-image icon on the one
  // screen customers see, so a failed load falls back to the placeholder.
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = product.image_url !== null && !imageBroken;

  // Single-variant products are the common case and their variant name
  // ("Única", "Normal") means nothing to a customer — show just the price.
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  const stepperFor = (variant: PublicMenuVariant) => {
    const qty = qtyByVariant.get(variant.id) ?? 0;
    return (
      <QtyStepper
        qty={qty}
        // Capping silently (the old behaviour) looked like a broken button.
        disabled={qty === 0 && cartFull}
        onAdd={() => onAdd(product, variant)}
        onRemove={() => onChangeQty(variant.id, qty - 1)}
      />
    );
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="relative aspect-[4/3] w-full bg-gray-100">
        {showImage ? (
          <Image
            src={product.image_url as string}
            alt={product.name}
            fill
            // Two columns on a phone, so each image is about half the viewport.
            sizes="(max-width: 640px) 50vw, 240px"
            className="object-cover"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center text-3xl text-gray-300"
          >
            🍽️
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
          {product.name}
        </p>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500">
            {product.description}
          </p>
        )}

        {singleVariant ? (
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            <span className="text-sm font-bold text-gray-900">
              {formatMoney(singleVariant.price)}
            </span>
            {stepperFor(singleVariant)}
          </div>
        ) : (
          <ul className="mt-auto space-y-2 pt-3">
            {product.variants.map((variant) => (
              <li key={variant.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-gray-600">{variant.name}</span>
                  <span className="block text-sm font-bold text-gray-900">
                    {formatMoney(variant.price)}
                  </span>
                </span>
                {stepperFor(variant)}
              </li>
            ))}
          </ul>
        )}

        {cartFull && !product.variants.some((v) => qtyByVariant.has(v.id)) && (
          <p className="mt-2 text-[11px] leading-tight text-amber-700">{t("cartFull")}</p>
        )}
      </div>
    </li>
  );
}

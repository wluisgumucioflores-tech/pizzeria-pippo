"use client";

import { CATEGORY_EMOJI } from "../constants/product.constants";

interface Props {
  category: string | null;
  size?: number;
}

export function CategoryIcon({ category, size = 24 }: Props) {
  return (
    <span style={{ fontSize: size, lineHeight: 1 }}>
      {(category && CATEGORY_EMOJI[category]) ?? "🍽️"}
    </span>
  );
}

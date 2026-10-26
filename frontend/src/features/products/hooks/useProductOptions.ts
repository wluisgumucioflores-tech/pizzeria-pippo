"use client";

import { useState, useEffect } from "react";
import { ProductsService } from "../services/products.service";

// Flat {value,label} list of the business's ACTIVE products, for settings
// screens that let an admin hand-pick products (today: the public QR menu,
// see docs/features/pedidos-online-qr/). Same shape and contract as
// useCategoryOptions. Inactive products are left out on purpose — picking one
// would store an id that never renders anywhere.
export function useProductOptions() {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    ProductsService.getProducts({ pageSize: 9999 })
      .then(({ data }) => {
        if (!mounted) return;
        setOptions(data.map((p) => ({ value: p.id, label: p.name })));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { options, loading };
}

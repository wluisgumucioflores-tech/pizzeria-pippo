"use client";

import { useState, useEffect } from "react";
import { CategoriesService } from "../services/categories.service";
import type { Category } from "../types/category.types";

export function useCategoryOptions() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    CategoriesService.getCategories().then((data) => {
      setCategories(data);
      setLoading(false);
    });
  }, []);

  const options = categories.map((c) => ({ value: c.id, label: c.name }));

  return { categories, options, loading };
}

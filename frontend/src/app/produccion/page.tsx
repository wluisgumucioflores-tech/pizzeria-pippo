"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProduccionIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/produccion/insumos");
  }, [router]);

  return null;
}

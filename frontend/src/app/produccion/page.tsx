"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserProfile } from "@/lib/auth";

export default function ProduccionIndexPage() {
  const router = useRouter();

  useEffect(() => {
    getUserProfile().then((profile) => {
      router.replace(profile?.enabled_modules.produccionStock ? "/produccion/stock" : "/produccion/insumos");
    });
  }, [router]);

  return null;
}

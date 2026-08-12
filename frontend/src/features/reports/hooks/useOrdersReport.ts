"use client";

import { useState, useCallback } from "react";
import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { UTC_OFFSET_HOURS } from "@/lib/timezone";
import { PAYMENT_PROVIDERS } from "@pippo/shared";
import { ReportsService } from "../services/reports.service";
import type { Order } from "../types/reports.types";

export function useOrdersReport() {
  const t = useTranslations("reports");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetch = useCallback(async (params: string, page = 1, pageSize = 10) => {
    setLoading(true);
    const result = await ReportsService.fetchOrders(params, page, pageSize);
    setOrders(result.data);
    setOrdersTotal(result.total);
    setLoading(false);
  }, []);

  const exportToExcel = useCallback(async (params: string) => {
    setExporting(true);
    const allOrders = await ReportsService.fetchAllOrdersForExport(params);
    setExporting(false);

    const h = {
      date: t("excel.headers.date"),
      branch: t("excel.headers.branch"),
      cashier: t("excel.headers.cashier"),
      type: t("excel.headers.type"),
      payment: t("excel.headers.payment"),
      product: t("excel.headers.product"),
      variant: t("excel.headers.variant"),
      qty: t("excel.headers.qty"),
      unitPrice: t("excel.headers.unitPrice"),
      discount: t("excel.headers.discount"),
      total: t("excel.headers.total"),
    };
    const none = t("plain.none");

    const rows = allOrders.flatMap((order) =>
      order.order_items.map((item) => ({
        [h.date]: dayjs(order.created_at).add(UTC_OFFSET_HOURS, "hour").format("DD/MM/YYYY HH:mm"),
        [h.branch]: order.branches?.name ?? none,
        [h.cashier]: order.cashier_name,
        [h.type]: order.order_type === "takeaway"
          ? t("plain.takeaway")
          : order.order_type === "delivery"
          ? t("plain.delivery")
          : order.order_type === "pedidos_ya"
          ? t("plain.pedidosYa")
          : t("plain.dineIn"),
        [h.payment]: order.payment_method === "efectivo" ? t("plain.cash")
          : order.payment_method === "qr" ? t("plain.qr")
          : order.payment_method === "online"
          ? (order.payment_provider
              ? PAYMENT_PROVIDERS[order.payment_provider as keyof typeof PAYMENT_PROVIDERS]?.label ?? t("plain.online")
              : t("plain.online"))
          : none,
        [h.product]: item.product_variants?.products?.name ?? none,
        [h.variant]: item.product_variants?.name ?? none,
        [h.qty]: item.qty,
        [h.unitPrice]: Number(item.unit_price).toFixed(2),
        [h.discount]: Number(item.discount_applied).toFixed(2),
        [h.total]: Number(order.total).toFixed(2),
      }))
    );

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("excel.sheetName"));
    XLSX.writeFile(wb, `ventas_${dayjs().format("YYYY-MM-DD")}.xlsx`);
  }, [t]);

  return { orders, ordersTotal, ordersPage, setOrdersPage, ordersPageSize, setOrdersPageSize, loading, exporting, fetch, exportToExcel };
}

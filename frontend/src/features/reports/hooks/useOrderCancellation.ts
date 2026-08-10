"use client";

import { useState } from "react";
import { message } from "antd";
import { useTranslations } from "next-intl";
import { ReportsService } from "../services/reports.service";
import type { Order } from "../types/reports.types";

export function useOrderCancellation(onSuccess: () => void) {
  const t = useTranslations("reports");
  const [cancelModal, setCancelModal] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const openCancelModal = (order: Order) => setCancelModal(order);
  const closeCancelModal = () => setCancelModal(null);

  const handleCancel = async (orderId: string, reason: string) => {
    setCancelling(true);
    const result = await ReportsService.cancelOrder(orderId, reason);
    setCancelling(false);
    if (result.ok) {
      setCancelModal(null);
      message.success(t("cancelSuccess"));
      onSuccess();
    } else {
      message.error(result.error ?? t("cancelError"));
    }
  };

  return { cancelModal, cancelling, openCancelModal, closeCancelModal, handleCancel };
}

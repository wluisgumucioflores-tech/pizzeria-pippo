"use client";

import { VariantSelectorModal } from "./VariantSelectorModal";
import { PaymentModal } from "./PaymentModal";
import { ConfirmSaleModal } from "./ConfirmSaleModal";
import { PaymentValidationModal } from "./PaymentValidationModal";
import { TicketModal } from "./TicketModal";
import { CancelOrderModal } from "./CancelOrderModal";
import { CollectPaymentModal } from "./CollectPaymentModal";
import type { usePosCart } from "../hooks/usePosCart";
import type { usePaymentValidation } from "../hooks/usePaymentValidation";
import type { usePosPageActions } from "../hooks/usePosPageActions";
import type { Product, Branch, Variant, DayOrder, PaymentMethod, SplitPayment } from "../types/pos.types";
import type { usePrinter } from "@/features/printing/hooks/usePrinter";

interface Props {
  branchId: string;
  branches: Branch[];
  products: Product[];
  cart: ReturnType<typeof usePosCart>;
  paymentValidation: ReturnType<typeof usePaymentValidation>;
  actions: ReturnType<typeof usePosPageActions>;
  getVariantPrice: (variant: Variant, branchId: string) => number;
  getPromoLabel: (variantId: string) => string | null;
  printer: ReturnType<typeof usePrinter>;
  cancelModal: DayOrder | null;
  cancelling: boolean;
  onCancelOrder: (orderId: string, reason: string) => void;
  onCloseCancelModal: () => void;
  payModal: DayOrder | null;
  paying: boolean;
  onPayOrder: (paymentMethod: PaymentMethod, payments: SplitPayment[] | null) => void;
  onClosePayModal: () => void;
}

export function PosModals({
  branchId, branches, products, cart, paymentValidation, actions,
  getVariantPrice, getPromoLabel, printer, cancelModal, cancelling, onCancelOrder, onCloseCancelModal,
  payModal, paying, onPayOrder, onClosePayModal,
}: Props) {
  return (
    <>
      <VariantSelectorModal
        product={actions.variantModal}
        branchId={branchId}
        allProducts={products}
        getVariantPrice={getVariantPrice}
        getPromoLabel={getPromoLabel}
        onSelect={actions.handleVariantSelect}
        onClose={() => actions.setVariantModal(null)}
      />
      <PaymentModal
        open={actions.paymentModal}
        total={cart.total}
        onClose={() => { actions.setPaymentModal(false); actions.setPaymentMethod(null); actions.setPaymentProvider(null); }}
        onConfirm={actions.handlePaymentConfirm}
      />
      <ConfirmSaleModal
        open={actions.confirmModal}
        discountedCart={cart.discountedCart}
        total={cart.total}
        totalDiscount={cart.totalDiscount}
        paymentMethod={actions.paymentMethod}
        paymentProvider={actions.paymentProvider}
        payments={actions.payments}
        orderType={cart.orderType}
        loading={actions.confirmLoading}
        onConfirm={actions.handleConfirmSale}
        onCancel={() => { actions.setConfirmModal(false); actions.setPaymentModal(true); }}
        onValidatePayment={actions.handleValidatePayment}
      />
      <PaymentValidationModal
        open={actions.validationModalOpen}
        state={paymentValidation.state}
        onConfirm={actions.handleValidationConfirm}
        onReject={paymentValidation.rejectMatch}
        onCancel={actions.handleValidationCancel}
      />
      <TicketModal
        ticket={actions.ticket}
        onClose={() => actions.setTicket(null)}
        onPrint={() => actions.ticket && printer.print(actions.ticket, branches.find((b) => b.id === branchId)?.name)}
        printing={printer.printing}
        canPrint={printer.status !== "unsupported"}
      />
      <CancelOrderModal order={cancelModal} loading={cancelling} onConfirm={onCancelOrder} onClose={onCloseCancelModal} />
      <CollectPaymentModal key={payModal?.id ?? "closed"} order={payModal} submitting={paying} onConfirm={onPayOrder} onClose={onClosePayModal} />
    </>
  );
}

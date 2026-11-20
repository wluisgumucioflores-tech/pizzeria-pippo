"use client";

import { Checkbox, Form, Radio, Switch, Typography } from "antd";
import { useTranslations } from "next-intl";
import {
  POS_ORDER_TYPES,
  POS_PAYMENT_METHODS,
  POS_PRESELECTABLE_PAYMENT_METHODS,
  type PosOrderTypeOption,
  type PosPaymentMethodOption,
  type PosPreselectablePaymentMethod,
} from "@pippo/shared";
import type { AppSettings } from "@/features/settings/types";

const { Text } = Typography;

const ORDER_TYPE_KEY: Record<PosOrderTypeOption, string> = {
  dine_in: "orderType.dineInEmoji",
  takeaway: "orderType.takeawayEmoji",
  delivery: "orderType.deliveryEmoji",
};

const PAYMENT_METHOD_KEY: Record<PosPaymentMethodOption, string> = {
  efectivo: "paymentMethod.cash",
  qr: "paymentMethod.qr",
  mixto: "paymentMethod.mixed",
  deferred: "paymentMethod.deferred",
};

interface Props {
  settings: AppSettings;
  onChange: (field: keyof AppSettings, value: string | boolean | string[]) => void;
}

export function PosCheckoutFlowFields({ settings, onChange }: Props) {
  const t = useTranslations("settings.pos");
  const tp = useTranslations("pos");

  // Dejar el POS sin ningún tipo de pedido (o sin ningún método) lo deja sin
  // poder cobrar: la última opción no se puede destildar.
  const handleOrderTypes = (values: PosOrderTypeOption[]) => {
    if (!values.length) return;
    onChange("pos_order_types", values);
    if (settings.pos_default_order_type && !values.includes(settings.pos_default_order_type as PosOrderTypeOption)) {
      onChange("pos_default_order_type", "");
    }
  };

  const handlePaymentMethods = (values: PosPaymentMethodOption[]) => {
    if (!values.length) return;
    onChange("pos_payment_methods", values);
    if (settings.pos_default_payment_method && !values.includes(settings.pos_default_payment_method as PosPaymentMethodOption)) {
      onChange("pos_default_payment_method", "");
    }
  };

  const preselectableTypes = POS_ORDER_TYPES.filter((type) => settings.pos_order_types.includes(type));
  const preselectableMethods = POS_PRESELECTABLE_PAYMENT_METHODS.filter((method) =>
    settings.pos_payment_methods.includes(method),
  );

  return (
    <>
      <Form.Item label={t("orderTypesLabel")} extra={t("orderTypesExtra")}>
        <Checkbox.Group
          className="flex flex-col gap-2"
          value={settings.pos_order_types}
          onChange={(values) => handleOrderTypes(values as PosOrderTypeOption[])}
          options={POS_ORDER_TYPES.map((type) => ({ label: tp(ORDER_TYPE_KEY[type]), value: type }))}
        />
      </Form.Item>

      <Form.Item label={t("defaultOrderTypeLabel")} extra={t("defaultOrderTypeExtra")}>
        <Radio.Group
          optionType="button"
          value={settings.pos_default_order_type ?? ""}
          onChange={(e) => onChange("pos_default_order_type", e.target.value)}
          options={[
            { label: t("noPreselection"), value: "" },
            ...preselectableTypes.map((type) => ({ label: tp(ORDER_TYPE_KEY[type]), value: type })),
          ]}
        />
      </Form.Item>

      <Form.Item label={t("pedidosYaLabel")} extra={t("pedidosYaExtra")}>
        <Switch
          checked={settings.pos_enable_pedidos_ya}
          onChange={(checked) => onChange("pos_enable_pedidos_ya", checked)}
        />
      </Form.Item>

      <Form.Item label={t("paymentMethodsLabel")} extra={t("paymentMethodsExtra")}>
        <Checkbox.Group
          className="flex flex-col gap-2"
          value={settings.pos_payment_methods}
          onChange={(values) => handlePaymentMethods(values as PosPaymentMethodOption[])}
          options={POS_PAYMENT_METHODS.map((method) => ({ label: tp(PAYMENT_METHOD_KEY[method]), value: method }))}
        />
      </Form.Item>

      <Form.Item label={t("defaultPaymentMethodLabel")} extra={t("defaultPaymentMethodExtra")}>
        <Radio.Group
          optionType="button"
          value={settings.pos_default_payment_method ?? ""}
          onChange={(e) => onChange("pos_default_payment_method", e.target.value)}
          options={[
            { label: t("noPreselection"), value: "" },
            ...preselectableMethods.map((method: PosPreselectablePaymentMethod) => ({
              label: tp(PAYMENT_METHOD_KEY[method]),
              value: method,
            })),
          ]}
        />
      </Form.Item>

      <Form.Item label={t("notesLabel")} extra={t("notesExtra")}>
        <Switch
          checked={settings.pos_enable_notes}
          onChange={(checked) => onChange("pos_enable_notes", checked)}
        />
      </Form.Item>

      <Form.Item
        label={t("skipConfirmLabel")}
        extra={
          <>
            {t("skipConfirmExtra")}{" "}
            <Text type="warning">{t("skipConfirmWarning")}</Text>
          </>
        }
      >
        <Switch
          checked={settings.pos_skip_confirm_step}
          onChange={(checked) => onChange("pos_skip_confirm_step", checked)}
        />
      </Form.Item>
    </>
  );
}

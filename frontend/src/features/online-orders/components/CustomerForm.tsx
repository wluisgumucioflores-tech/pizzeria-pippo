"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CUSTOMER_NAME_MAX,
  CUSTOMER_NAME_MIN,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_PATTERN,
} from "../constants/online-orders.constants";
import { formatMoney } from "../lib/money";

interface Props {
  /** Shown on the submit button so the amount is visible at the moment of sending. */
  total: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (customer: { name: string; phone: string; notes: string }) => void;
}

// Just the fields and the submit button. The order summary used to live here
// too, but the cart tab now renders an editable line list right above it and
// two summaries on one screen is noise.
export function CustomerForm({ total, submitting, error, onSubmit }: Props) {
  const t = useTranslations("onlineOrders");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);

  const nameValid = name.trim().length >= CUSTOMER_NAME_MIN;
  const phoneValid = CUSTOMER_PHONE_PATTERN.test(phone.trim());
  const valid = nameValid && phoneValid;

  const handleSubmit = () => {
    setTouched(true);
    if (!valid || submitting) return;
    onSubmit({ name, phone, notes });
  };

  return (
    <div className="mt-6">
      <h2 className="text-lg font-bold text-gray-900">{t("yourData")}</h2>
      <p className="mt-1 text-sm text-gray-500">{t("yourDataHint")}</p>

      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("nameLabel")}</span>
          <input
            type="text"
            value={name}
            maxLength={CUSTOMER_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none focus:border-orange-500"
          />
          {touched && !nameValid && (
            <span className="mt-1 block text-xs text-red-600">{t("nameInvalid")}</span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("phoneLabel")}</span>
          <input
            // "tel" brings up the numeric keypad on a phone, which is the
            // whole audience of this page.
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+59170000000"
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-base outline-none focus:border-orange-500"
          />
          {touched && !phoneValid && (
            <span className="mt-1 block text-xs text-red-600">{t("phoneInvalid")}</span>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">{t("notesLabel")}</span>
          <textarea
            value={notes}
            maxLength={CUSTOMER_NOTES_MAX}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-3 text-base outline-none focus:border-orange-500"
          />
        </label>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-orange-500 py-4 text-base font-semibold text-white active:scale-95 disabled:opacity-60"
      >
        {submitting ? t("sending") : `${t("sendOrder")} · ${formatMoney(total)}`}
      </button>
    </div>
  );
}

"use client";

import { Modal, Button } from "antd";
import { useTranslations } from "next-intl";
import type { Branch, Cashier } from "../types/branch.types";

interface Props {
  data: { branch: Branch; cashiers: Cashier[] } | null;
  onClose: () => void;
}

export function BranchBlockedModal({ data, onClose }: Props) {
  const t = useTranslations("branches.blockedModal");

  return (
    <Modal
      title={t("title")}
      open={!!data}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("understood")}</Button>}
    >
      <p className="mb-3">
        {t.rich("body", {
          count: data?.cashiers.length ?? 0,
          name: data?.branch.name ?? "",
          b: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>
      <ul className="list-disc pl-5">
        {data?.cashiers.map((c) => (
          <li key={c.id}>{c.full_name}</li>
        ))}
      </ul>
    </Modal>
  );
}

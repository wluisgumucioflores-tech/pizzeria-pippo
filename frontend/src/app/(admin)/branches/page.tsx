"use client";

import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import type { EnabledModules } from "@pippo/shared";
import { BranchesTable } from "@/features/branches/components/BranchesTable";
import { BranchModal } from "@/features/branches/components/BranchModal";
import { BranchBlockedModal } from "@/features/branches/components/BranchBlockedModal";
import { BranchQrModal } from "@/features/online-orders/components/BranchQrModal";
import { useBranches } from "@/features/branches/hooks/useBranches";
import { useRegisterRefresh } from "@/lib/refresh-context";
import type { Branch } from "@/features/branches/types/branch.types";

export default function BranchesPage() {
  const { data: identity } = useGetIdentity<{ enabled_modules?: EnabledModules }>();
  const [qrBranch, setQrBranch] = useState<Branch | null>(null);
  const onlineOrdersEnabled = identity?.enabled_modules?.onlineOrders === true;
  const {
    branches, loading, saving, showInactive, setShowInactive,
    modalOpen, editing, blockModal, form,
    openCreate, openEdit, closeModal, closeBlockModal,
    handleSubmit, handleToggleActive, handleDelete,
    refetch,
  } = useBranches();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <BranchesTable
        branches={branches}
        loading={loading}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onShowQr={onlineOrdersEnabled ? setQrBranch : undefined}
      />
      <BranchModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
      <BranchBlockedModal
        data={blockModal}
        onClose={closeBlockModal}
      />
      <BranchQrModal branch={qrBranch} onClose={() => setQrBranch(null)} />
    </div>
  );
}

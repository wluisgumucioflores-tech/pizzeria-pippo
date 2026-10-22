"use client";

import { EmployeesTable } from "@/features/employees/components/EmployeesTable";
import { EmployeeModal } from "@/features/employees/components/EmployeeModal";
import { EmployeeCredentialModal } from "@/features/employees/components/EmployeeCredentialModal";
import { useEmployees } from "@/features/employees/hooks/useEmployees";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function EmployeesPage() {
  const {
    employees, branches, loading, saving,
    modalOpen, editing, credential,
    openCreate, openEdit, closeModal, closeCredentialModal,
    handleSubmit, handleToggleActive, handleRegenerateCredential,
    refetch,
  } = useEmployees();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <EmployeesTable
        employees={employees}
        branches={branches}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onRegenerateCredential={handleRegenerateCredential}
      />
      <EmployeeModal
        open={modalOpen}
        editing={editing}
        branches={branches}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
      <EmployeeCredentialModal
        credential={credential}
        onClose={closeCredentialModal}
      />
    </div>
  );
}

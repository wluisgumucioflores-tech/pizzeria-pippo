"use client";

import { UsersTable } from "@/features/users/components/UsersTable";
import { UserModal } from "@/features/users/components/UserModal";
import { ResetPasswordModal } from "@/features/users/components/ResetPasswordModal";
import { useUsers } from "@/features/users/hooks/useUsers";
import { useRegisterRefresh } from "@/lib/refresh-context";

export default function UsersPage() {
  const {
    users, branches, enabledModules, loading, saving,
    modalOpen, editing, selectedRole, form,
    openCreate, openEdit, closeModal,
    handleRoleChange, handleSubmit, handleToggleBan, handleDelete,
    resetPasswordUser, resettingPassword, resetPasswordForm,
    openResetPassword, closeResetPasswordModal, handleResetPasswordSubmit,
    refetch,
  } = useUsers();
  useRegisterRefresh(refetch);

  return (
    <div className="p-6">
      <UsersTable
        users={users}
        branches={branches}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleBan={handleToggleBan}
        onDelete={handleDelete}
        onResetPassword={openResetPassword}
      />
      <UserModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        selectedRole={selectedRole}
        branches={branches}
        enabledModules={enabledModules}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
        onRoleChange={handleRoleChange}
      />
      <ResetPasswordModal
        open={!!resetPasswordUser}
        user={resetPasswordUser}
        saving={resettingPassword}
        form={resetPasswordForm}
        onClose={closeResetPasswordModal}
        onSubmit={handleResetPasswordSubmit}
      />
    </div>
  );
}

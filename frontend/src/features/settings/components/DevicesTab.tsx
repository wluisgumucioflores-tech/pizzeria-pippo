"use client";

import { DevicesTable } from "@/features/devices/components/DevicesTable";
import { DeviceModal } from "@/features/devices/components/DeviceModal";
import { DeviceApiKeyModal } from "@/features/devices/components/DeviceApiKeyModal";
import { useDevices } from "@/features/devices/hooks/useDevices";

export function DevicesTab() {
  const {
    devices, branches, loading, saving, modalOpen, editing, newApiKey,
    openCreate, openEdit, closeModal, closeApiKeyModal, handleSubmit, handleToggleActive, handleDelete,
  } = useDevices();
  return (
    <div>
      <DevicesTable
        devices={devices}
        branches={branches}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
      />
      <DeviceModal
        open={modalOpen}
        editing={editing}
        branches={branches}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
      <DeviceApiKeyModal apiKey={newApiKey} onClose={closeApiKeyModal} />
    </div>
  );
}

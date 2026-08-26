"use client";

import { McpKeysTable } from "@/features/mcp/components/McpKeysTable";
import { McpKeyModal } from "@/features/mcp/components/McpKeyModal";
import { McpKeyApiKeyModal } from "@/features/mcp/components/McpKeyApiKeyModal";
import { useMcpKeys } from "@/features/mcp/hooks/useMcpKeys";

export function McpTab() {
  const {
    keys, loading, saving, modalOpen, newApiKey,
    openCreate, closeModal, closeApiKeyModal, handleSubmit, handleToggleActive,
  } = useMcpKeys();
  return (
    <div>
      <McpKeysTable
        keys={keys}
        loading={loading}
        onCreate={openCreate}
        onToggleActive={handleToggleActive}
      />
      <McpKeyModal
        open={modalOpen}
        saving={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
      <McpKeyApiKeyModal apiKey={newApiKey} onClose={closeApiKeyModal} />
    </div>
  );
}

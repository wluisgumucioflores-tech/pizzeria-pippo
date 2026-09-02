"use client";

import { AiModelsTable } from "@/features/ai-models/components/AiModelsTable";
import { AiModelModal } from "@/features/ai-models/components/AiModelModal";
import { useAiModels } from "@/features/ai-models/hooks/useAiModels";

export default function AiModelsPage() {
  const { models, loading, saving, modalOpen, editing, form, openCreate, openEdit, closeModal, handleSubmit, handleToggleActive } =
    useAiModels();

  return (
    <div className="p-6">
      <AiModelsTable
        models={models}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
      />
      <AiModelModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        form={form}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

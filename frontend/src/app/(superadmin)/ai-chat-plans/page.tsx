"use client";

import { AiChatPlansTable } from "@/features/ai-chat-plans/components/AiChatPlansTable";
import { AiChatPlanModal } from "@/features/ai-chat-plans/components/AiChatPlanModal";
import { useAiChatPlans } from "@/features/ai-chat-plans/hooks/useAiChatPlans";

export default function AiChatPlansPage() {
  const { plans, models, loading, saving, modalOpen, editing, form, openCreate, openEdit, closeModal, handleSubmit, handleToggleActive } =
    useAiChatPlans();

  return (
    <div className="p-6">
      <AiChatPlansTable
        plans={plans}
        models={models}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
      />
      <AiChatPlanModal
        open={modalOpen}
        editing={editing}
        saving={saving}
        form={form}
        models={models}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

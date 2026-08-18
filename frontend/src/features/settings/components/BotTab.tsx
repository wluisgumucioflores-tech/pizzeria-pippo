"use client";

import { BotSettingsForm } from "@/features/telegram-bot/components/BotSettingsForm";
import { AuthorizedChatsTable } from "@/features/telegram-bot/components/AuthorizedChatsTable";
import { ChatModal } from "@/features/telegram-bot/components/ChatModal";
import { useTelegramChats } from "@/features/telegram-bot/hooks/useTelegramChats";

export function BotTab() {
  const { chats, loading, modalOpen, editing, openCreate, openEdit, closeModal, handleSave, handleToggleActive, handleDelete } = useTelegramChats();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <BotSettingsForm />
      <AuthorizedChatsTable
        chats={chats}
        loading={loading}
        onCreate={openCreate}
        onEdit={openEdit}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
      />
      <ChatModal open={modalOpen} editing={editing} onClose={closeModal} onSave={handleSave} />
    </div>
  );
}

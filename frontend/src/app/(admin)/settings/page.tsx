"use client";

import { Tabs } from "antd";
import { BellOutlined, RobotOutlined, CommentOutlined, FireOutlined, PrinterOutlined, MobileOutlined, DatabaseOutlined, ShopOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { TelegramSettingsForm } from "@/features/settings/components/TelegramSettingsForm";
import { KitchenSettingsForm } from "@/features/settings/components/KitchenSettingsForm";
import { PrinterSettingsForm } from "@/features/settings/components/PrinterSettingsForm";
import { StockSettingsForm } from "@/features/settings/components/StockSettingsForm";
import { PosSettingsForm } from "@/features/settings/components/PosSettingsForm";
import { BotSettingsForm } from "@/features/telegram-bot/components/BotSettingsForm";
import { AuthorizedChatsTable } from "@/features/telegram-bot/components/AuthorizedChatsTable";
import { ChatModal } from "@/features/telegram-bot/components/ChatModal";
import { useTelegramChats } from "@/features/telegram-bot/hooks/useTelegramChats";
import { DevicesTable } from "@/features/devices/components/DevicesTable";
import { DeviceModal } from "@/features/devices/components/DeviceModal";
import { DeviceApiKeyModal } from "@/features/devices/components/DeviceApiKeyModal";
import { useDevices } from "@/features/devices/hooks/useDevices";
import { AiChatSettingsForm } from "@/features/ai-chat/components/AiChatSettingsForm";

function BotTab() {
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

function DevicesTab() {
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

export default function SettingsPage() {
  const t = useTranslations("settings.tabs");
  return (
    <div className="p-6">
      <Tabs
        items={[
          {
            key: "notifications",
            label: <span><BellOutlined /> {t("notifications")}</span>,
            children: <TelegramSettingsForm />,
          },
          {
            key: "kitchen",
            label: <span><FireOutlined /> {t("kitchen")}</span>,
            children: <KitchenSettingsForm />,
          },
          {
            key: "bot",
            label: <span><RobotOutlined /> {t("bot")}</span>,
            children: <BotTab />,
          },
          {
            key: "ai-chat",
            label: <span><CommentOutlined /> {t("aiChat")}</span>,
            children: <AiChatSettingsForm />,
          },
          {
            key: "printer",
            label: <span><PrinterOutlined /> {t("printer")}</span>,
            children: <PrinterSettingsForm />,
          },
          {
            key: "devices",
            label: <span><MobileOutlined /> {t("devices")}</span>,
            children: <DevicesTab />,
          },
          {
            key: "stock",
            label: <span><DatabaseOutlined /> {t("stock")}</span>,
            children: <StockSettingsForm />,
          },
          {
            key: "pos",
            label: <span><ShopOutlined /> {t("pos")}</span>,
            children: <PosSettingsForm />,
          },
        ]}
      />
    </div>
  );
}

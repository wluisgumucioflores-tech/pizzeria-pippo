"use client";

import { Tabs } from "antd";
import { BellOutlined, RobotOutlined, FireOutlined, PrinterOutlined, MobileOutlined, DatabaseOutlined, ShopOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useGetIdentity } from "@refinedev/core";
import { DEFAULT_ENABLED_MODULES, type EnabledModules } from "@pippo/shared";
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

interface Identity {
  enabled_modules?: EnabledModules;
}

export default function SettingsPage() {
  const t = useTranslations("settings.tabs");
  const { data: identity } = useGetIdentity<Identity>();
  const enabledModules = identity?.enabled_modules ?? DEFAULT_ENABLED_MODULES;

  const items = [
    {
      key: "notifications",
      label: <span><BellOutlined /> {t("notifications")}</span>,
      children: <TelegramSettingsForm />,
      hidden: !enabledModules.telegram,
    },
    {
      key: "kitchen",
      label: <span><FireOutlined /> {t("kitchen")}</span>,
      children: <KitchenSettingsForm />,
      hidden: !enabledModules.kitchen,
    },
    {
      key: "bot",
      label: <span><RobotOutlined /> {t("bot")}</span>,
      children: <BotTab />,
      hidden: !enabledModules.telegram,
    },
    {
      key: "printer",
      label: <span><PrinterOutlined /> {t("printer")}</span>,
      children: <PrinterSettingsForm />,
      hidden: !enabledModules.printer,
    },
    {
      key: "devices",
      label: <span><MobileOutlined /> {t("devices")}</span>,
      children: <DevicesTab />,
      hidden: !enabledModules.printer,
    },
    {
      key: "stock",
      label: <span><DatabaseOutlined /> {t("stock")}</span>,
      children: <StockSettingsForm />,
      hidden: !enabledModules.stock,
    },
    {
      key: "pos",
      label: <span><ShopOutlined /> {t("pos")}</span>,
      children: <PosSettingsForm />,
    },
  ].filter((item) => !item.hidden);

  return (
    <div className="p-6">
      <Tabs items={items} />
    </div>
  );
}

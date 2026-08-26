"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { McpKeysService } from "../services/mcp-keys.service";
import type { McpKey } from "../types/mcp-key.types";

export function useMcpKeys() {
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setKeys(await McpKeysService.getKeys());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);
  const closeApiKeyModal = () => setNewApiKey(null);

  const handleSubmit = async (values: { name: string }) => {
    setSaving(true);
    const result = await McpKeysService.createKey(values);
    if (result.ok && result.result) {
      setModalOpen(false);
      setNewApiKey(result.result.apiKey);
      load();
    } else {
      message.error(result.error ?? "Error al crear la API key");
    }
    setSaving(false);
  };

  const handleToggleActive = async (key: McpKey) => {
    const result = await McpKeysService.updateKey(key.id, { is_active: !key.is_active });
    if (result.ok) {
      message.success(key.is_active ? "API key desactivada" : "API key reactivada");
      load();
    } else {
      message.error(result.error ?? "Error al actualizar");
    }
  };

  return {
    keys, loading, saving, modalOpen, newApiKey,
    openCreate, closeModal, closeApiKeyModal,
    handleSubmit, handleToggleActive,
  };
}

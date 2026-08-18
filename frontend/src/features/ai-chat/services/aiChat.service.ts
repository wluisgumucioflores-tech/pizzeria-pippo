import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import { SETTINGS_KEYS } from "../constants/ai-chat-settings.constants";
import type { ChatMessage } from "../types";

export async function getChatSettings(): Promise<Record<string, string>> {
  const res = await nestFetch(API_ENDPOINTS.settings.rawByKeys(SETTINGS_KEYS));
  if (!res.ok) return {};
  return res.json();
}

export async function saveChatSettings(updates: { key: string; value: string }[]): Promise<void> {
  const res = await nestFetch(API_ENDPOINTS.settings.raw, {
    method: "PUT",
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error("Error al guardar la configuración");
}

export async function generateInternalKey(): Promise<string> {
  const res = await nestFetch(API_ENDPOINTS.aiChat.generateInternalKey, { method: "POST" });
  if (!res.ok) throw new Error("Error al generar la API key interna");
  const data = await res.json();
  return data.apiKey;
}

export async function sendChatMessage(messages: ChatMessage[], locale: string): Promise<string> {
  const res = await nestFetch(API_ENDPOINTS.aiChat.message, {
    method: "POST",
    body: JSON.stringify({ messages, locale }),
  });
  if (!res.ok) throw new Error("Error al enviar el mensaje");
  const data = await res.json();
  return data.content;
}

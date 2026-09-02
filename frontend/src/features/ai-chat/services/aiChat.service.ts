import { nestFetch } from "@/lib/nestFetch";
import { API_ENDPOINTS } from "@/lib/api-endpoints";
import type { ChatMessage } from "../types";

export async function sendChatMessage(messages: ChatMessage[], locale: string, branchId?: string): Promise<string> {
  const res = await nestFetch(API_ENDPOINTS.aiChat.message, {
    method: "POST",
    body: JSON.stringify({ messages, locale, branch_id: branchId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? data.error ?? "Error al enviar el mensaje");
  }
  const data = await res.json();
  return data.content;
}

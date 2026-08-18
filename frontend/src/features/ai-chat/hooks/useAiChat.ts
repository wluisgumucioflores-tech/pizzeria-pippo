"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { sendChatMessage } from "../services/aiChat.service";
import type { ChatMessage } from "../types";

export function useAiChat() {
  const t = useTranslations("aiChatWidget");
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setSending(true);
    try {
      const content = await sendChatMessage(next, locale);
      setMessages([...next, { role: "assistant", content }]);
    } catch {
      setMessages([...next, { role: "assistant", content: t("error") }]);
    } finally {
      setSending(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
  };

  return { messages, sending, sendMessage, resetChat };
}

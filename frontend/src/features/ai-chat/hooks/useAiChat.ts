"use client";

import { useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { sendChatMessage } from "../services/aiChat.service";
import { BranchesService } from "@/features/branches/services/branches.service";
import type { Branch } from "@/features/branches/types/branch.types";
import type { ChatMessage } from "../types";

export function useAiChat() {
  const t = useTranslations("aiChatWidget");
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setSending(true);
    try {
      const content = await sendChatMessage(next, locale, selectedBranchId);
      setMessages([...next, { role: "assistant", content }]);
    } catch (err) {
      const content = err instanceof Error && err.message ? err.message : t("error");
      setMessages([...next, { role: "assistant", content }]);
    } finally {
      setSending(false);
    }
  };

  // Only relevant for an admin at a multi-branch business — a cajero/mesero
  // (single branch visible) or a single-branch business never show a
  // selector, the backend resolves that default on its own (see
  // AiChatProxyService.resolveEffectiveBranch).
  const resetChat = useCallback(() => {
    setMessages([]);
    setSelectedBranchId(undefined);
    BranchesService.getBranches().then(setBranches);
  }, []);

  return { messages, sending, branches, selectedBranchId, setSelectedBranchId, sendMessage, resetChat };
}

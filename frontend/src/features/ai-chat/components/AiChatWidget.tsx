"use client";

import { useState, useRef, useEffect } from "react";
import { FloatButton, Card, Input, Button, Space, Typography, Spin } from "antd";
import { CommentOutlined, SendOutlined, CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useAiChat } from "../hooks/useAiChat";

const { Text } = Typography;

export function AiChatWidget() {
  const t = useTranslations("aiChatWidget");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sending, sendMessage, resetChat } = useAiChat();
  const listRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) resetChat();
      return next;
    });
  };

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <>
      {open && (
        <Card
          size="small"
          title={t("title")}
          extra={<Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)} />}
          style={{
            position: "fixed",
            bottom: 88,
            right: 24,
            width: 360,
            height: 480,
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}
          styles={{ body: { flex: 1, display: "flex", flexDirection: "column", padding: 12, overflow: "hidden" } }}
        >
          <div
            ref={listRef}
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}
          >
            {messages.length === 0 && (
              <Text type="secondary" style={{ fontSize: 13 }}>{t("emptyState")}</Text>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#f97316" : "#f5f5f5",
                  color: m.role === "user" ? "#fff" : "#000",
                  borderRadius: 12,
                  padding: "6px 12px",
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && <Spin size="small" style={{ alignSelf: "flex-start" }} />}
          </div>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={handleSend}
              placeholder={t("placeholder")}
              disabled={sending}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={sending} />
          </Space.Compact>
          <Text type="secondary" style={{ fontSize: 11, textAlign: "center", marginTop: 6 }}>
            {t("disclaimer")}
          </Text>
        </Card>
      )}
      <FloatButton icon={<CommentOutlined />} type="primary" style={{ right: 24, bottom: 24 }} onClick={handleToggle} />
    </>
  );
}

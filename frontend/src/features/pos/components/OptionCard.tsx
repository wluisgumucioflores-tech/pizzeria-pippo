"use client";

import { CheckCircleFilled } from "@ant-design/icons";

export interface OptionCardProps {
  selected: boolean;
  emoji: string;
  label: string;
  accent: "orange" | "blue";
  onClick: () => void;
}

export function OptionCard({ selected, emoji, label, accent, onClick }: OptionCardProps) {
  const colors =
    accent === "orange"
      ? { border: "#f97316", bg: "#fff7ed", text: "#ea580c", badge: "#ffedd5" }
      : { border: "#3b82f6", bg: "#eff6ff", text: "#2563eb", badge: "#dbeafe" };
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl py-4 px-3 text-center cursor-pointer relative"
      style={{
        border: selected ? `2px solid ${colors.border}` : "1px solid #e5e7eb",
        background: selected ? colors.bg : "#fff",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {selected && (
        <CheckCircleFilled
          style={{ position: "absolute", top: 8, right: 10, color: colors.text, fontSize: 18 }}
        />
      )}
      <div
        className="mx-auto flex items-center justify-center rounded-lg"
        style={{ width: 44, height: 44, background: colors.badge, fontSize: 22 }}
      >
        {emoji}
      </div>
      <div
        className="text-sm mt-2"
        style={{ color: selected ? colors.text : "#374151", fontWeight: selected ? 600 : 500 }}
      >
        {label}
      </div>
    </button>
  );
}

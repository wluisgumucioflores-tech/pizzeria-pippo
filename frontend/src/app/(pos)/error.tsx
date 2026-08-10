"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function PosErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("pos.error");

  useEffect(() => {
    console.error("[pos-error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-8">
      <h1 className="text-red-600 text-2xl font-bold">{t("title")}</h1>
      <p className="text-gray-500 max-w-sm">
        {t("message")}
      </p>
      {error.digest && (
        <p className="text-gray-400 text-xs">{t("code", { digest: error.digest })}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        {t("retry")}
      </button>
    </div>
  );
}

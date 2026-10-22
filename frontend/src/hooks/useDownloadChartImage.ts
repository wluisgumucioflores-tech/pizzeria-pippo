"use client";

import { useRef, useState, useCallback } from "react";
import { message } from "antd";
import { toPng } from "html-to-image";
import dayjs from "dayjs";

// Shared by every Recharts card (dashboard + reports) to export it as a PNG,
// entirely client-side (no API route / server work). Captures the whole
// card — title, legend, labels included — via html-to-image instead of
// serializing just the inner <svg>, because Recharts renders its Legend as
// an absolutely-positioned HTML <ul>, not SVG, so a raw SVG export would
// silently drop it.
export function useDownloadChartImage(filename: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const download = useCallback(async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
        // Excludes the download button itself from its own screenshot —
        // see data-chart-export-exclude on ChartDownloadButton.
        filter: (node) => (node as HTMLElement).dataset?.chartExportExclude !== "true",
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${filename}_${dayjs().format("YYYY-MM-DD_HH-mm")}.png`;
      link.click();
    } catch {
      message.error("No se pudo descargar el gráfico. Intentá de nuevo.");
    } finally {
      setDownloading(false);
    }
  }, [filename]);

  return { ref, download, downloading };
}

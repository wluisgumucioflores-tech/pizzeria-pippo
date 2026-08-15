"use client";

import Image from "next/image";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";

export function KitchenHeader({
  branchName,
  connected,
  lateCount,
  pendingCount,
  currentTime,
  refreshing,
  onRefresh,
  onLogout,
}: {
  branchName: string;
  connected: boolean;
  lateCount: number;
  pendingCount: number;
  currentTime: string;
  refreshing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="bg-gray-950 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Pippo"
          width={36}
          height={36}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <p className="text-white font-bold text-lg leading-none">Cocina</p>
          {branchName && (
            <p className="text-gray-400 text-sm leading-none mt-0.5">{branchName}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {!connected && (
          <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
            🔴 Sin conexión
          </span>
        )}
        {lateCount > 0 && (
          <span className="bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
            ⚠ {lateCount} demorado{lateCount > 1 ? "s" : ""}
          </span>
        )}
        <span className="text-gray-400 text-sm">
          {pendingCount === 0
            ? "Sin pedidos pendientes"
            : `${pendingCount} pedido${pendingCount > 1 ? "s" : ""} pendiente${pendingCount > 1 ? "s" : ""}`}
        </span>
        <span className="text-gray-300 font-mono text-xl">{currentTime}</span>
        <LocaleSwitcher dark />
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-gray-300 hover:text-white text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>🔄</span> Actualizar
        </button>
        <button
          onClick={onLogout}
          className="text-gray-300 hover:text-white text-sm font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors whitespace-nowrap"
        >
          🚪 Salir
        </button>
      </div>
    </div>
  );
}

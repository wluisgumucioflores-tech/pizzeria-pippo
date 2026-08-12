"use client";

import { signOut } from "@/lib/auth";
import { LocaleSwitcher } from "@/features/i18n/components/LocaleSwitcher";
import { useMeseroName } from "../hooks/useMeseroName";

export function MeseroNameGate({ children }: { children: React.ReactNode }) {
  const { name, loaded, setName, clearName } = useMeseroName();

  const handleLogout = async () => {
    clearName();
    await signOut();
    window.location.href = "/login";
  };

  if (!loaded) return null;

  if (!name) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form
          className="w-full max-w-sm bg-white rounded-lg shadow-md p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("waiterName") as HTMLInputElement;
            setName(input.value);
          }}
        >
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-1">¿Cómo te llamás?</h1>
            <p className="text-gray-500 text-base">Tu nombre se va a usar para identificar tus pedidos</p>
          </div>
          <input
            name="waiterName"
            type="text"
            required
            autoFocus
            placeholder="Tu nombre"
            className="w-full px-3 py-3 border border-gray-300 rounded-md text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md text-lg transition-colors cursor-pointer"
          >
            Empezar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center justify-between bg-white border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <span className="font-semibold text-gray-800 text-lg">{name}</span>
        </div>
        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <button
            type="button"
            onClick={clearName}
            className="text-base text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Cambiar de mesero
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-base text-red-500 hover:text-red-700 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

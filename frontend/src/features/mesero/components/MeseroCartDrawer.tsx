"use client";

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MeseroCartDrawer({ open, onClose, children }: Props) {
  return (
    <div className={`lg:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl shadow-xl flex flex-col transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-gray-800">Pedido</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

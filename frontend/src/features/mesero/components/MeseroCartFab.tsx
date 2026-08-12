"use client";

interface Props {
  itemCount: number;
  onClick: () => void;
}

export function MeseroCartFab({ itemCount, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-orange-600 hover:bg-orange-700 text-white shadow-lg flex items-center justify-center cursor-pointer"
    >
      <span className="text-2xl">🛒</span>
      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
        {itemCount}
      </span>
    </button>
  );
}

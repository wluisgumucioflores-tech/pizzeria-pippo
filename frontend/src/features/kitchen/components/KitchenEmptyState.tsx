export function KitchenEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
      <span className="text-7xl">🍕</span>
      <p className="text-2xl font-semibold">Sin pedidos pendientes</p>
      <p className="text-base">Los nuevos pedidos aparecerán aquí automáticamente</p>
    </div>
  );
}

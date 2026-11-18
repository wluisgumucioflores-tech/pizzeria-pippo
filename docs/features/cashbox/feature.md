# Caja chica y registro de gastos

## Estado

**Implementado.** Backend (módulo `cashbox`), frontend (feature `cashbox`, widget en el POS, tab "Caja" en Reportes) y migración (`docs/database/migrations/077_cashbox.sql`, pendiente de aplicar manualmente en Supabase). Sin tests automatizados todavía.

## Objetivo

Que cajero/admin puedan registrar, por turno y por sucursal:
1. Apertura de caja — cuánto dinero había al empezar el turno.
2. Gastos de caja chica durante el turno (insumos, mantenimiento, transporte, otro).
3. Cierre de caja — cuánto se contó al final, comparado contra lo esperado.

Y que el admin pueda ver el histórico de turnos (Reportes → Caja).

## Decisiones confirmadas con el usuario

- **Feature flag por negocio**: módulo `cashbox` en `enabled_modules` (`packages/shared/src/constants/business-modules.ts`), off por defecto, controlado por el superadmin — mismo mecanismo que `produccion`/`onlineOrders`. Razón: toca dinero/reconciliación y es nuevo, conviene activarlo gradualmente por negocio en vez de autoservicio.
- **Alcance de los registros**: por sucursal (`branchId`), no solo por negocio — cada sucursal maneja su propio efectivo.
- **Cálculo del esperado**: `Esperado = Apertura + Ventas en efectivo del turno − Gastos registrados`. "Ventas en efectivo" reusa el mismo criterio que `ReportsService.getSales` (una orden `mixto` no tiene un solo método; su pata en efectivo vive en `order_payments`).
- **Una sola sesión abierta por sucursal a la vez** (índice único parcial en la migración) — evita que se abra una sesión nueva sin haber cerrado la anterior.
- **Auto-cierre sin inventar un conteo**: si un turno queda abierto de un día anterior, un cron horario (`CashboxService.autoCloseStaleSessions`) lo marca `auto_closed` con `counted_amount`/`expected_amount` en `null` — nunca asume que cuadró. Queda visible en el reporte como pendiente de revisión, y no bloquea abrir una sesión nueva al día siguiente.
- **Categorías de gasto fijas por ahora**: `insumos`, `mantenimiento`, `transporte`, `otro`. Si el negocio necesita categorías propias, eso pasa a configuración por negocio en una fase futura, no se agranda este set a mano.

## Diseño técnico

- **DB**: `cash_sessions` (una fila por turno) + `cash_expenses` (gastos de un turno, en cascada). Ver comentarios en la migración para las constraints (una sesión abierta por sucursal, campos de cierre consistentes con el status).
- **Backend**: `backend/src/cashbox/` — `CashboxService` resuelve apertura/gasto/cierre/listado y el cron de auto-cierre; `CashboxController` expone `/cashbox/sessions/*` (abrir/gasto/cerrar para cualquier rol autenticado con el módulo activo, `GET /cashbox/sessions` admin-only para el reporte).
- **Frontend**: `frontend/src/features/cashbox/` — `useCashSession` (POS: sesión actual + abrir/gasto/cerrar) y `useCashSessionsReport` (Reportes → Caja). Wireado en `(pos)/pos/page.tsx` (slot en `PosHeader` + 3 modales) y en `(admin)/reports/page.tsx` (tab condicionado a `enabledModules.cashbox`).

## Pendiente / fuera de alcance de esta primera versión

- Aplicar la migración 077 en Supabase y actualizar `schema-base.sql` después (regla del proyecto).
- Tests automatizados.
- Categorías de gasto configurables por negocio.
- Reporte de caja en PDF/export (hoy solo tabla en pantalla).

# 20 — Multitenant: plataforma SaaS de comercios

## Estado

**No implementado.** En fase de investigación técnica + planificación. Nada de este documento está construido todavía — es la referencia a leer antes de tocar cualquier módulo relacionado con `business_id`/`businesses`.

## Objetivo

La app deja de ser "la app de Pizzería Pippo" y pasa a ser un SaaS: varios comercios gastronómicos (pizzería, hamburguesería, etc.) operan cada uno con su propio panel admin, POS, cocina, inventario y reportes — la experiencia que hoy tiene Pippo — con sus datos **completamente aislados** entre sí, a nivel de base de datos (no solo de UI).

El primer rubro es pizzería (Pippo = comercio #1), pero el diseño debe servir para otros rubros sin cambios estructurales.

## Contexto

Hace tiempo se empezó un soporte multi-tenant (migración `034_businesses_multitenant.sql` + tabla `businesses`) pero quedó a medio camino: **no está aplicado en producción**, y aunque se aplicara tal cual, el aislamiento seguiría sin existir — casi ninguna tabla de negocio tiene `business_id`, y ni RLS ni el backend NestJS filtran por negocio salvo el módulo `settings`.

El backend usa Prisma con conexión directa a Postgres, lo que evita RLS — el aislamiento real depende 100% de que NestJS filtre cada query.

## Actores

| Actor | Quién es | Qué puede hacer |
|---|---|---|
| **Superadmin** *(nuevo)* | Dueño de la plataforma | Ver comercios registrados, métricas básicas, crear/suspender/reactivar comercios. No opera dentro del negocio de un comercio |
| **Admin del comercio** | Rol `admin` actual | Todo lo de hoy, pero solo sobre su comercio |
| **Cajero / Cocinero** | Personal operativo | POS y cocina de su sucursal, igual que hoy |

## Alcance del MVP

**Incluye:**
- Concepto de comercio (tenant) en toda la BD, con Pippo migrado como comercio #1
- Aislamiento total de datos entre comercios a nivel de base de datos
- Rol y panel de superadmin (lista, alta manual, suspender/activar, métricas básicas)
- Configuraciones por comercio (Telegram, cocina, impresora — hoy son globales)
- Branding básico por comercio: nombre y logo en login, POS, cocina, display, notificaciones y ticket (hoy "Pippo" está hardcodeado en ~11 archivos)

**No incluye (futuro):**
- Registro self-service de comercios
- Billing / planes de pago (campo preparado, sin cobranza)
- Subdominios por comercio
- Branding avanzado (colores/tema, PWA con ícono propio)
- Categorías de producto configurables por rubro
- Bot Telegram multitenant

## Decisiones ya tomadas

- Aislamiento por columna `business_id` + RLS en una sola base de datos (no schemas ni proyectos Supabase separados)
- Acceso por login, sin subdominios en esta etapa
- Alta de comercios manual por el superadmin (self-service queda para el futuro)
- Modo soporte del superadmin: "ver comercio" en solo lectura (banner visible, escrituras bloqueadas por la BD) — sin impersonation con escritura. Un rol `soporte` separado queda para cuando haya equipo de soporte
- Límites por plan: estructura desde ya (`max_branches`, `max_users` con defaults generosos), enforcement al crear sucursal/usuario — billing queda para después

## Qué falta técnicamente (resumen)

- `business_id` falta en casi todas las tablas de negocio (`branches`, `products`, `promotions`, `stock`, `employees`, `devices`, etc.) — solo `Profile` y `AppSetting` lo tienen hoy
- Ningún módulo NestJS filtra por negocio salvo `settings` (vía `resolveBusinessId()`, es la plantilla a replicar)
- No existe `BusinessGuard` — solo `RolesGuard` y `OwnBranchOrAdminGuard`, y este último tiene un bypass de admin que dejaría cruzar negocios si se replica sin ajustar
- RLS de Supabase no usa `business_id` en ninguna política, y `authenticated_read_businesses` expone todos los nombres de comercio a cualquier autenticado
- `orders.gateway.ts` (realtime) no valida `branchId` del handshake contra el usuario — bug independiente, ya explotable hoy
- `products.business_id` es un cabo suelto: se menciona como existente en un comentario de migración pero no está documentado en ningún schema real

Detalle completo de la auditoría: `docs/research/2026-06-09-multitenant-feasibility.md`.

## Plan de fases

| Fase | Qué cubre | Estado |
|---|---|---|
| F0 | Schema Prisma + migraciones + backfill | En progreso (dev) — `docs/features/multitenant/plan-f0-f1-foundations.md` |
| F1 | Guards + scoping backend módulo por módulo | En progreso — mismo documento, sección 3.3 lleva el checklist archivo por archivo |
| F2 | Reescribir RLS + aplicar en producción | Sin plan todavía |
| F3 | UI de superadmin + branding | Sin plan todavía |

## Criterios de éxito

- Un usuario del comercio A no puede ver ni modificar ningún dato del comercio B, ni manipulando requests — lo impide la BD, no la interfaz
- Pippo opera exactamente igual que antes de la migración (regresión cero)
- El superadmin da de alta un segundo comercio y este opera completo (productos → POS → cocina → reportes) sin tocar código
- El segundo comercio ve su nombre y logo en login, POS, cocina, display y ticket
- Suspender un comercio bloquea el acceso de sus usuarios de inmediato

## Referencias

- Investigación técnica: `docs/research/2026-06-09-multitenant-feasibility.md`
- Plan F0-F1: `docs/features/multitenant/plan-f0-f1-foundations.md`
- Migraciones relevantes: `docs/database/migrations/034_businesses_multitenant.sql`, `docs/database/migrations/040_businesses_backfill.sql`
- Definición de producto (Obsidian): `features/testing/20-multitenant.md` en el vault del proyecto

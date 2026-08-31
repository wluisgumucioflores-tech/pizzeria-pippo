# CLAUDE.md — Guía de trabajo para Claude

## Stack Tecnológico

- **Next.js 14** (App Router) — framework principal
- **Refine** + **Ant Design** — panel admin
- **Tailwind CSS** — POS y display cliente
- **NestJS** — backend (API, auth, lógica de negocio), conecta a Supabase Postgres vía Prisma
- **Supabase** — solo PostgreSQL + Storage (la Auth de Supabase ya NO se usa, ver sección "Autenticación y Sesiones")
- **next-intl** — i18n (español default, inglés soportado)
- **next-pwa** — PWA para el admin

---

## Comandos Disponibles

- El usuario ejecuta manualmente `npm run dev` y `npm run build` — Claude **nunca** ejecuta estos dos comandos
- Claude **puede ejecutar** cualquier otro comando: `npm install`, `mkdir`, mover archivos, `tsc --noEmit`, etc.
- **Excepción**: si el usuario invoca manualmente un skill que requiere `npm run build` (ej. `/validate-build`), Claude sí puede ejecutarlo como parte de ese skill. La regla general sigue aplicando fuera de esos skills.

---

## Reglas de Comportamiento

### Development Approach
- NEVER rush ahead with multiple features at once. Implement ONE feature at a time.
- After implementing a feature, ask the user to validate before proceeding.
- When building UI components, show the user what you plan to build BEFORE writing code.

### Debugging Rules
- Identify the ACTUAL root cause before attempting fixes.
- Limit yourself to 3 attempts on a single bug before asking for more context.
- If first fix doesn't work, step back and re-read error/logs before trying another.

### Code Changes
- After refactors touching multiple files, run `tsc --noEmit` BEFORE presenting work as complete.
- Do not add columns, fields, or summary stats that weren't explicitly requested.

---

## Arquitectura de Código — Feature-Based

Todo nuevo feature debe seguir esta estructura. **Nunca agregar lógica directamente en `page.tsx`.**

```
src/features/<nombre>/
├── components/   ← UI pura, sin queries ni lógica de negocio
├── hooks/        ← estado, lógica, llamadas a services
├── services/     ← API calls y queries a Supabase
├── types/        ← interfaces TypeScript
└── constants/    ← config estática (opciones de select, colores, etc.)
```

### Reglas de tamaño obligatorias

| Archivo | Máximo |
|---|---|
| `page.tsx` | 100 líneas |
| `components/` | 200 líneas |
| `hooks/` | 200 líneas |
| `services/` | 150 líneas |

> Si un archivo supera **300 líneas**, debe dividirse antes de continuar.

### Responsabilidades

- **`page.tsx`** — solo layout: importa componentes y hooks, sin lógica ni queries
- **`hooks/`** — estado y lógica de negocio, llama a services
- **`services/`** — comunicación con backend y Supabase, sin estado
- **`components/`** — UI, recibe props, sin queries directas a Supabase

### Regla estricta: hooks nunca tocan Supabase directamente

**Los hooks NO deben importar `supabase` ni llamar a `supabase.from()` directamente.**

Toda comunicación con Supabase debe pasar por el service de la feature:

```ts
// ❌ MAL — hook hace query directa
import { supabase } from "@/lib/supabase";
const { data } = await supabase.from("branches").select("*");

// ✅ BIEN — hook delega al service
import { MyService } from "../services/my.service";
const branches = await MyService.getBranches();
```

- **Token** → nunca leer el token manualmente en un hook; usar `getToken()` de `@/lib/auth`
- **Realtime** (WebSockets contra el backend NestJS) → encapsular en métodos del service (`subscribeToX`, `unsubscribe`)

### Ejemplo de estructura para una feature

Usar `branches` como referencia al implementar cualquier feature nuevo:

```
src/features/branches/
├── components/
│   ├── BranchesTable.tsx         ← tabla con columnas y acciones
│   ├── BranchModal.tsx           ← modal crear/editar
│   └── BranchBlockedModal.tsx    ← modal de bloqueo con cajeros asignados
│
├── hooks/
│   └── useBranches.ts            ← fetch, crear, editar, toggle activo
│
├── services/
│   └── branches.service.ts       ← getBranches(), createBranch(), updateBranch()
│
└── types/
    └── branch.types.ts           ← Branch, Cashier
```

`page.tsx` resultado esperado (~25 líneas):
```tsx
"use client";
import { BranchesTable } from "@/features/branches/components/BranchesTable";
import { BranchModal } from "@/features/branches/components/BranchModal";
import { useBranches } from "@/features/branches/hooks/useBranches";

export default function BranchesPage() {
  const { branches, loading, modalOpen, editing, openCreate, openEdit, closeModal } = useBranches();
  return (
    <div className="p-6">
      <BranchesTable branches={branches} loading={loading} onCreate={openCreate} onEdit={openEdit} />
      <BranchModal open={modalOpen} editing={editing} onClose={closeModal} />
    </div>
  );
}
```

Los módulos actuales aún no siguen esta arquitectura. El plan de refactor está documentado en:
`docs/improves/refactor-architecture/` — un archivo por módulo, en orden de prioridad.

---

## Autenticación y Sesiones

**Supabase Auth NO se usa.** La autenticación es 100% custom, emitida y validada por el backend NestJS. Supabase queda solo como motor Postgres (vía Prisma).

### Backend (`backend/src/auth/`)

- **Login** — `POST /auth/login` (`auth.controller.ts` → `auth.service.ts`): busca el `profile` + `business` en Prisma, rechaza con el mismo mensaje genérico si el usuario está baneado (`profiles.is_banned`) o si `business.isActive === false` (evita enumeración de usuarios). Password comparado con bcrypt. Firma un JWT propio (`{ sub: profile.id }`, secret `JWT_SECRET`).
- **TTL diferenciado por rol**: `mesero` → 6h (tablet fija), resto de roles → `JWT_EXPIRES_IN` (default 10h).
- **Validación en cada request** — `JwtAuthGuard` → `JwtStrategy.validate()` (`jwt.strategy.ts`): verifica firma/expiración y **re-consulta la DB** (perfil + business) en cada llamada, rechazando si el usuario fue baneado o el negocio suspendido después de emitido el token. Esto significa que suspender un negocio corta el acceso de inmediato, no solo en el próximo login.
- **Autorización por rol** — `RolesGuard` + `@Roles(...)`, usuario inyectado vía `@CurrentUser()`.
- **WebSockets** (reemplazo de `supabase.channel()`) — `orders.gateway.ts` valida el token manualmente con `AuthService.resolveUserFromToken()` en `handleConnection`, sin pasar por Passport.
- **Sin estado de sesión en DB** — no hay tabla de sesiones, refresh tokens ni blacklist. El JWT es stateless hasta su `exp`.

### Frontend (`frontend/src/lib/auth.ts`)

- `getToken()` — única función permitida para leer el token; lee de `localStorage["pippo_auth_token"]`, valida expiración del payload, y devuelve `""` si no existe o expiró (nunca rechaza).
- `signIn(email, password)` — `POST /auth/login`, guarda `access_token` en `localStorage`.
- `signOut()` — **puramente client-side**: solo borra el token de `localStorage`. No invalida nada en el backend. Por eso cerrar sesión en un dispositivo **no afecta** sesiones activas del mismo usuario en otros dispositivos — cada login genera un JWT independiente.
- `getUserProfile()` — `GET /auth/me` con `Authorization: Bearer`.
- Cliente HTTP centralizado: `nestFetch.ts` agrega el header `Authorization` automáticamente a cada llamada al backend.

### Protección de rutas — NO ocurre en `middleware.ts`

`middleware.ts` es un no-op intencional (deja pasar todo). La protección real es **client-side**, en cada `layout.tsx`:
- `/admin` y `/superadmin` → `AuthProvider` de Refine (`authProvider.ts` / `authProviderSuperadmin.ts`), valida `role` y hace logout automático en 401.
- `kitchen`, `mesero`, `(pos)` → guards ad-hoc con `getUserProfile()` en el layout. Mesero además hace polling cada 60s (`SESSION_CHECK_INTERVAL_MS`) porque su sesión de 6h suele quedar inactiva en la tablet.

Al construir una ruta o feature nueva que requiera auth, seguir este mismo patrón (guard en `layout.tsx`), no depender de `middleware.ts`.

---

## Base de Datos — Convenciones de Migración

Los archivos de la base de datos viven en `docs/database/`:

```
docs/database/
├── schema-base.sql      ← Schema real actual (exportado de Supabase, solo referencia)
├── README.md            ← Convenciones y reglas
└── migrations/          ← Un archivo por cada cambio aplicado después del schema inicial
    ├── 002_*.sql
    ├── 003_*.sql
    └── ...
```

### Reglas obligatorias para cambios en la BD

1. **Antes de aplicar cualquier cambio en Supabase**, crear el archivo de migración en `docs/database/migrations/` con el nombre `NNN_descripcion.sql` (número secuencial de 3 dígitos).
2. **Después de aplicar el cambio**, actualizar `docs/database/schema-base.sql` para reflejar el estado real.
3. **Nunca modificar** `supabase/001_schema.sql` — ese archivo es el estado inicial del proyecto.
4. Si un cambio ya fue aplicado en Supabase pero no estaba documentado, crear igual el archivo con una nota `-- Ya aplicado en Supabase el YYYY-MM-DD`.
5. Los archivos de migración son documentación/referencia — se aplican **manualmente** en el SQL Editor de Supabase, no se ejecutan automáticamente.

---

## Código del Proyecto

- El código estará escrito en **inglés** (variables, funciones, componentes, comentarios)
- La interfaz de usuario se mostrará en **español**
- Internacionalización con **next-intl** — español (default) e inglés soportados

---

## Referencias

Para más detalle sobre el sistema ver `README.md` y `docs/`.

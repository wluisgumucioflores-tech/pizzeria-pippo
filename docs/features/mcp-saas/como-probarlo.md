# mcp-saas — cómo levantarlo y probarlo localmente

Ver `feature.md` en esta misma carpeta para el diseño completo. Esta es la guía paso a paso para correrlo de punta a punta en dev.

## 1. Base de datos — aplicar las 2 migraciones nuevas

Local (Docker):
```bash
cd docker && docker compose up -d db
# esperar unos segundos a que levante, luego:
psql "postgresql://postgres:superpassword@localhost:54322/postgres" -f ../docs/database/migrations/056_mcp_api_keys.sql
psql "postgresql://postgres:superpassword@localhost:54322/postgres" -f ../docs/database/migrations/057_business_enabled_modules_mcp_saas.sql
```

Supabase hosted: copiar/pegar el contenido de esos dos archivos en el SQL Editor, en orden.

## 2. Levantar el backend

```bash
npm run backend:dev
```

## 3. Habilitar el módulo para un negocio

Logueado como `superadmin` en el panel admin: **Negocios → editar el negocio → tildar "MCP" → guardar**.

## 4. Generar la API key

Logueado como `admin` de ese negocio: **Settings → tab "MCP" → "Nueva API key"**. Copiar el valor (`pippo_mcp_...`) — no se vuelve a mostrar.

## 5. Levantar mcp-saas

```bash
cd services/mcp-saas
cp .env.example .env   # PIPPO_BACKEND_URL ya apunta a localhost:3333 por default
npm run dev
```

Debería loguear:
```
mcp-saas escuchando en http://localhost:8787
Backend Pippo: http://localhost:3333
Endpoint MCP: http://localhost:8787/mcp
```

## 6. Probarlo con MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

En la UI que abre:
- **Transport Type**: `Streamable HTTP`
- **URL**: `http://localhost:8787/mcp`
- **Headers**: `Authorization: Bearer pippo_mcp_...` (la key del paso 4)
- Conectar y probar **List Tools** (deberían aparecer las 6 del allowlist) y **Call Tool** sobre alguna (ej. `ReportsController_getSales`) — debería devolver datos reales del negocio.

## 7. (Opcional) Exponerlo hacia afuera con un túnel de Cloudflare

```bash
cloudflared tunnel --url http://localhost:8787
```

Da una URL pública temporal — ahí sí se puede apuntar un cliente MCP remoto (Claude u otra app) a esa URL + `/mcp`.

## Verificación negativa

Revocar la key (`is_active: false` desde la tabla en Settings → MCP) y reintentar el paso 6 — el intercambio `/mcp/token` debe fallar con 401 y el Inspector no debería poder listar tools.

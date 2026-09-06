---
name: validate-build
description: Runs and validates the build for backend (NestJS), frontend (Next.js), services/mcp-saas (Node/Hono MCP service), and services/ai-orchestrator (Java Spring Boot chat-ia orchestrator). Accepts an optional scope argument — "all" (default), "backend", "frontend", "mcp-saas", or "ai-orchestrator" — to build only part of the monorepo. Use whenever the user says "validate the build", "check if it compiles", "run the build", "why is the build failing", or before committing/shipping a version. If the build fails, diagnose the error and fix it automatically when it's a compilation, type, or import error; for changes to business logic, ask for confirmation before touching the code.
---

# Validate Build

## Goal
Verify that the requested part(s) of the monorepo compile without errors, and automatically fix trivial build issues (syntax, types, missing imports, missing dependencies in package.json). Do NOT modify business logic without explicit user confirmation.

## Scope argument

This skill can be invoked with an optional argument telling it which part(s) to build. Parse the raw argument text (space or comma separated) against these values:

- No argument, or `all` → run backend + frontend + mcp-saas + ai-orchestrator
- `backend` → only step 1
- `frontend` → only step 2
- `mcp-saas` → only step 3
- `ai-orchestrator` → only step 4
- Any combination of these names (e.g. `backend frontend`) → only the matching steps
- Anything that doesn't match one of these names → ask the user to clarify instead of guessing which section they meant

## Steps

Run only the step(s) selected by the scope argument.

1. **Backend (NestJS)** — `backend/`
   - Run: `npm run build` (equivalent to `nest build`, compiles TypeScript to `dist/`)
   - If it fails: read the full error (typically TS errors, misused decorators, missing DI for modules/providers)
   - If it's trivial (wrong type, missing import, missing provider in a module, syntax error), fix it directly
   - If the error implies changing a service/controller's logic, a DTO, or an endpoint's shape, explain the problem and ask before touching anything

2. **Frontend (Next.js)** — `frontend/`
   - Run: `npm run build` (equivalent to `next build`)
   - If it fails: same criteria — TypeScript errors, imports, missing component props get fixed automatically; changes to component logic or state get confirmed first

3. **mcp-saas (Node/Hono service)** — `services/mcp-saas/`
   - Run: `npm run build` (runs `tsc`, compiles TypeScript to `dist/`)
   - If it fails: same criteria — TS/import errors get fixed automatically; changes to the actual tool-registry/tool-executor/pippo-client logic (how tools are derived or executed) get confirmed first

4. **ai-orchestrator (Java Spring Boot, chat-ia orchestrator)** — `services/ai-orchestrator/`
   - Run: `./gradlew compileJava` (compiles main sources only — same "does it build" scope as the other three, not a full `./gradlew build` which would also run tests)
   - If it fails: read the full error (typically type errors, missing imports, wrong `@Tool`/`@Bean` wiring, Spring AI `ChatClient` misuse)
   - If it's trivial (wrong type, missing import, missing annotation, syntax error), fix it directly
   - If the error implies changing a tool's behavior, an agent's registration, or the orchestration flow (`ChatOrchestrationService`, `AgentRegistry`), explain the problem and ask before touching anything

## Final report
- State explicitly, per section actually run: ✅ builds / ❌ fails (and why)
- If a section was skipped because of the scope argument, don't report on it at all
- If automatic fixes were made, list which files were touched and what changed (short diff)

## Rules
- Never commit or push as part of this skill
- Never modify config files (`.env`, `docker-compose.yml`, `nest-cli.json`, `next.config.js`, `wrangler.jsonc`, `build.gradle.kts`, `application.yml`) without asking
- If every section that was run passes, no need to ask anything else — just confirm everything's OK

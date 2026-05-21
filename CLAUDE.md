# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SAP CAP (Cloud Application Programming Model) inventory movement system built for a Software Engineering course. Stack: Node.js + `@sap/cds` v9, PostgreSQL 16 (production), SQLite in-memory (development/test), SAPUI5 (Fiori Elements frontend).

## Commands

```bash
# Development (hot-reload with SQLite)
npm run dev

# Open the Fiori app in browser with live reload
npm run watch-logestoque

# Production
npm start

# Run all tests
npm test

# Unit tests only
node --test test/unit/

# Integration tests only
node --test test/integration/

# Single test file
node --test test/unit/moviment-rules.test.js

# Verbose output
node --test --reporter=spec test/**/*.test.js

# Validate CDS models (run before commit)
npx cds compile db/ && npx cds compile srv/

# Docker
docker compose up
```

## Architecture

### Services

| Service | Path | Auth | Audience |
|---|---|---|---|
| `MainService` | `/odata/v4/main` | `authenticated-user` | Fiori Elements UI |
| `EndpointsService` | `/odata/v4/endpoints` | `ADMIN` role | Admin tooling / scripts |
| REST auth | `/auth/*` | Public (`/login`) / Bearer (`/me`) | All clients |

The server bootstrap is in `srv/server.js`, which wires the JWT auth middleware and login handler into the CAP Express app via `cds.on('bootstrap', ...)`.

### Data model namespaces (in `db/`)

- `db.types` — `MovimentTypes`, `MovimentStatus` enums
- `db.auth` — `Users`, `Permissions`, `UserPermissions`
- `db.masterdata` — `Materials`, `Addresses`, `DistributionCenters`, `Warehouses`
- `db.inventory` — `Stocks`, `Moviments`, `StockHistory`

`db/index.cds` aggregates all namespaces. **Do not create circular imports**: `master-data.cds` must not import `inventory.cds`.

### Auth flow

Custom JWT middleware in `srv/auth/auth-middleware.js` intercepts all requests, calls `jwt.verify()`, and populates `cds.context.user` with roles from the token's `permissions` array. The CAP `@requires` annotations then enforce RBAC. JWT is signed with `JWT_SECRET` (env var, ≥32 chars required).

Roles: `ADMIN`, `ESTOQUE`, `APROVACAO`, `VIEWER`, `LOGISTICA`.

### Database profiles

- `[development]` / `[testing]` — SQLite in-memory, test data loaded from `test/data/*.csv`
- `[production]` — `@cap-js/postgres` (set via env: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`)

### Frontend

`app/logestoque/` is a UI5/TypeScript workspace. `Component.ts` injects the Bearer token into the OData model. Fiori Elements (List Report + Object Page) is driven by annotations in `app/logestoque/annotations.cds`. Freestyle views only for Login and the Stock Dashboard (`app/logestoque/webapp/view/`).

## Testing conventions

- Test runner: `node:test` (no external runner)
- Assertions: `node:assert/strict`
- Integration tests use `@cap-js/cds-test` which starts a full CAP server with SQLite in-memory
- Business-rule validation must live in pure functions in `srv/moviment-rules.js` (no CDS dependency) so unit tests can import them directly
- CSV fixtures in `test/data/` use fixed UUIDs so integration tests can reference known IDs

## Environment variables

Copy `.env.example` and fill in values. Required:

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Min 32 chars; no default in production |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL (production only) |

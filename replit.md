# Bingo OroDig

Una plataforma de bingo virtual premium con estilo casino moderno — fondos oscuros elegantes, acentos dorados, tiempo real con Socket.io, y panel de administrador completo.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/bingo-orodig run dev` — run the frontend (port 20969)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + Framer Motion
- API: Express 5 + Socket.io
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (localStorage `bingo_token`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (users, rooms, games, cards, chat, transactions)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — JWT auth middleware
- `artifacts/api-server/src/lib/bingo.ts` — Card generation, pattern validation, ball letters
- `artifacts/api-server/src/lib/socket.ts` — Socket.io setup and emit helpers
- `artifacts/bingo-orodig/src/lib/auth.tsx` — AuthContext + JWT token management
- `artifacts/bingo-orodig/src/pages/` — All frontend pages

## Demo Credentials

- Admin: `admin` / `admin123`
- Jugador: `jugador` / `123456`

## Architecture decisions

- JWT stored in localStorage under key `bingo_token`; `setAuthTokenGetter` wires it into every API call
- Socket.io path is `/api/socket.io` (must be listed in `artifact.toml` paths for the proxy to forward it)
- Bingo cards are 5x5 grids stored as JSON strings; center cell (0) is always FREE
- Pattern validation happens server-side in `/cards/:id/claim` to prevent cheating
- Ball drawing is manual (admin) by default; number selection is random from remaining pool

## Product

Full virtual bingo platform with:
- Multi-room bingo (classic, fast, VIP, automatic)
- Real-time ball drawing and card marking via Socket.io
- Automatic winner detection (line, diagonal, corners, X, full card)
- Virtual currency system (balance, purchase cards, prizes)
- Live in-room chat
- Admin dashboard: stats, room/game/user management, manual ball draw
- Player profile, leaderboard, transaction history

## Gotchas

- After OpenAPI spec changes, always re-run codegen before building backend routes
- Socket.io path MUST be listed in `artifacts/api-server/.replit-artifact/artifact.toml` paths array
- The `dark` class is always applied to `document.documentElement` (dark-only theme)
- `real` must be imported from `drizzle-orm/pg-core` in any schema that uses it

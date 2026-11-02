# NFL Wordle — Project Constitution

Guiding principles for this repository. All contributions (human or agent) should conform to these.

## 1. Stack & Scope

- **Backend**: Express 5 + Prisma 7 + PostgreSQL, TypeScript. Lives in `backend/`.
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind 4, TypeScript. Lives in `frontend/`.
- Keep changes scoped to one side of the stack unless a contract change requires both.

## 2. Source of Truth

- The running backend is the **Express** stack rooted at `backend/src/server.ts`.
- NestJS files (`src/main.ts`, `src/app.module.ts`, `src/prisma/*`) are leftover scaffold and MUST NOT be treated as the entrypoint.
- Game logic lives in `backend/src/services/game.service.ts`; HTTP parsing in `backend/src/controllers`; routing in `backend/src/routes`.

## 3. API Contract

- All routes are served under `/api`.
- Game hints use exactly: `"correct" | "incorrect" | "higher" | "lower"`.
- A guess is a win only when team, position, and jersey all match.
- Maximum 6 guesses. Score by attempt: `[100, 80, 60, 40, 20, 10, 0]`.
- The secret player is revealed only after the game ends.
- The frontend consumes the API exclusively via `NEXT_PUBLIC_API_URL`.

## 4. Data Integrity

- Schema changes go through Prisma migrations (`npx prisma migrate dev`); never edit applied migrations.
- The seed (`prisma/seed.ts`) upserts 32 teams, then loads players from the Sleeper API; it requires network access and `DATABASE_URL`.

## 5. Security & Secrets

- NEVER commit `.env` files or secrets.
- `DATABASE_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend) are required and must be provided out-of-band.
- Preserve existing protections: helmet, CORS allowlist, and rate limiting in `backend/src/server.ts`.
- Validate all request bodies with Zod at the controller boundary.

## 6. Quality Gates

- TypeScript is the source language; keep strict, typed boundaries where practical.
- Lint and format before considering work complete: `npm run lint` (both), `npm run format` (backend).
- Backend tests use Jest + supertest against the exported `app` and require a seeded database.
- Frontend has no test suite; verify builds with `npm run build`.

## 7. Conventions

- Do not add comments unless their intent is non-obvious or the user asks.
- Follow existing file, naming, and style patterns in each subdirectory.
- Keep the official docs in `AGENTS.md` files (`AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`) in sync with behavior changes.

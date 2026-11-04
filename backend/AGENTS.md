# Backend — NFL Wordle API

Express 5 + Prisma 7 + PostgreSQL. TypeScript, run with `ts-node`/nodemon in dev and compiled to `dist/`.

## Commands

- Dev: `npm run dev` — nodemon on `src/server.ts` (the real entrypoint)
- Build: `npm run build` — `prisma generate && tsc -p tsconfig.build.json`
- Start (prod): `npm start` — migrate deploy + seed + `node dist/src/server.js`
- Test: `npx jest` (config: `jest.config.ts`, preset ts-jest, matches `*.test.ts`)
- E2E: `npm run test:e2e` (config: `test/jest-e2e.json`)
- Lint: `npm run lint` (eslint, `--fix`) · Format: `npm run format` (prettier)
- Migrate: `npx prisma migrate dev` · Seed: `npx prisma db seed`

## Architecture

The running app is the **Express** stack, not Nest:
- `src/server.ts` — creates `app`, applies helmet, cors, rate limit, mounts routers, listens.
- `src/routes/*.ts` — `gameRouter` (`/api/game`) and `playersRoute` (`/api/players`).
- `src/controllers/game.controller.ts` — request parsing; validates body with Zod (`guessSchema`).
- `src/services/game.service.ts` — all game logic and Prisma queries.
- `src/middleware/error.middleware.ts` — Zod → 400, "Game not found" → 404, else 500.
- `src/lib/prisma.ts` — shared `PrismaClient` via `PrismaPg` adapter.

NestJS files (`main.ts`, `app.module.ts`, `src/prisma/*`) are leftover scaffold and are NOT the entrypoint. Edit the Express path for behavior changes.

## Data model (`prisma/schema.prisma`)

`Team` —1:N→ `Player`; `GameSession` (secret + attempts/score) —1:N→ `Guess`; `DailyGame` (one per date string, `YYYY-MM-DD`).

## Game rules

`comparePlayers` returns per-attribute hints: `"correct" | "incorrect" | "higher" | "lower"` (jersey is numeric high/low). A win requires team + position + jersey all correct. Max 6 guesses; score table `[100, 80, 60, 40, 20, 10, 0]` indexed by attempt. Secret is only revealed when the game ends.

- `isFinished` and `secretPlayer` are derived from the persisted session's `isFinished` flag.
- A finished session rejects further guesses with `"Game already finished"` (400).
- `attempts` increments on every accepted guess. Guess processing is atomic.
- `Guess.result` persists the hint object (not a boolean).

## Tests & cleanup

- Jest host safety guard aborts runs if `DATABASE_URL` host is not local (`src/test/setup.ts`).
- Test helper `src/test/helpers/game.ts` tracks sessions and auto-cleans them in `afterAll` (deletes `Guess` rows first, then `GameSession`).
- Reconciliation script: `scripts/reconcile-attempts.ts` (`--dry-run`, prints host, requires `--confirm` for non-local DB). Not covered by the Jest guard.

## API

- `POST /api/game/start` → `{ id }`
- `POST /api/game/:id/guess` body `{ playerId: number }`
- `GET /api/game/:id`
- `GET /api/game/daily/today`
- `GET /api/game/leaderboard/top`
- `GET /api/players` · `GET /api/players/random` · `GET /api/players/search?q=`

## Data / seed

`prisma/seed.ts` upserts all 32 teams, then fetches players from the Sleeper API (`https://api.sleeper.app/v1/players/nfl`), keeps those with a team and non-DEF position, and inserts them. Requires network access and `DATABASE_URL`.

## Conventions

- `DATABASE_URL` is required (`.env`, loaded via `dotenv/config` in `src/lib/prisma.ts`).
- CORS allows `http://localhost:3001` and the Vercel prod origin.
- CORS/rate-limit/error handling live in `server.ts`; keep new routes under `/api`.
- Tests use supertest against the exported `app` and require a seeded database.

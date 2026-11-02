# 001 — Current State Specification

Documentation of **how the NFL Wordle project behaves today**. This is a description of the existing system, not a proposal for changes.

## 1. Purpose & Scope

NFL Wordle is a fullstack Wordle-style game where a player tries to identify a secret NFL player using clues about team, position, jersey number, conference, and division.

In scope:
- Running backend (Express) and its game logic.
- Data model and persistence.
- Frontend user flow and components.
- Known inconsistencies in the current implementation.

Out of scope:
- Proposed features or redesigns.
- Deployment topology beyond what the source implies.

## 2. Architecture

### 2.1 Backend (the running stack)

The application actually runs as an **Express 5** server, entered at `backend/src/server.ts`.

- `src/server.ts` — creates `app`, applies middleware, mounts routers under `/api`, and listens on `PORT` (default `3000`).
- `src/routes/game.ts` — `gameRouter` at `/api/game`.
- `src/routes/players.ts` — `playersRoute` at `/api/players`.
- `src/controllers/game.controller.ts` — parses requests and validates the guess body with Zod.
- `src/services/game.service.ts` — all game logic and Prisma access.
- `src/middleware/error.middleware.ts` — maps `ZodError` → 400, `"Game not found"` → 404, `"Game already finished"` → 400, otherwise 500.
- `src/lib/prisma.ts` — single shared `PrismaClient` using the `PrismaPg` adapter, with `DATABASE_URL` loaded via `dotenv/config`.
- `src/utils/asyncHandler.ts` — wraps async handlers and forwards rejections to `next`.

Middleware applied in `server.ts`:
- `cors` with an allowlist (`http://localhost:3001`, `https://findfootballplayer.vercel.app`) and `credentials: true`.
- `express.json()`.
- `helmet`.
- `express-rate-limit`: 100 requests per 15 minutes per window, message `"Too many requests, try again later"`.

### 2.2 Unused NestJS scaffold

The repository still contains NestJS files that are **not** part of the running application:

- `src/main.ts`, `src/app.module.ts`, `src/prisma/prisma.module.ts`, `src/prisma/prisma.service.ts`.
- `test/app.e2e-spec.ts` (expects `Hello World!`, which the Express app never serves).
- `nest-cli.json` and Nest dependencies in `package.json`.

These are leftover scaffold and should not be treated as the entrypoint.

### 2.3 Frontend

Next.js 16 (App Router) + React 19 + Tailwind 4, TypeScript.

- `app/page.tsx` — landing page with a "Start Game" link to `/game`.
- `app/game/page.tsx` — client component; starts a game on mount and submits guesses.
- `app/components/PlayerInput.tsx` — client component; debounced autocomplete and keyboard navigation.
- `app/components/GuessRow.tsx` — renders one guess with per-attribute colors.
- `app/layout.tsx` — root layout (Geist fonts, `app/globals.css`).

All API calls use `${process.env.NEXT_PUBLIC_API_URL}/api/...`.

## 3. Data Model

Prisma models (`backend/prisma/schema.prisma`), PostgreSQL:

- **Team** — `id`, `name` (unique), `conference`, `division`, `abr` (unique); 1:N `players`.
- **Player** — `id`, `name`, `position`, `jerseyNumber`, `yearsActive`, `age`, `teamId` → `Team`; 1:N `gameSessions` (as secret), `guesses`, `dailySecrets`.
- **GameSession** — `id`, `secretPlayerId` → `Player`, `attempts` (default 0), `isFinished` (default false), `isWin` (default false), `score` (nullable); 1:N `guesses`.
- **Guess** — `id`, `gameSessionId` → `GameSession`, `playerId` → `Player`, `result` (`Json`).
- **DailyGame** — `id`, `date` (unique, `YYYY-MM-DD`), `secretPlayerId` → `Player`, `createdAt`.

Migrations live under `prisma/migrations/` and are applied with `npx prisma migrate dev`.

## 4. Game Mechanics

### 4.1 Attribute comparison

`comparePlayers(secret, guess)` in `game.service.ts` returns per-attribute hints using exactly:

- `team` — `"correct"` if `guess.teamId === secret.teamId`, else `"incorrect"`.
- `position` — `"correct"` if positions match, else `"incorrect"`.
- `jersey` — `"correct"` if equal; otherwise `"lower"` when the guess is higher than the secret, and `"higher"` when the guess is lower (numeric high/low).
- `conference` — `"correct"` / `"incorrect"`.
- `division` — `"correct"` / `"incorrect"`.

### 4.2 Win condition

A guess is a win only when **team, position, and jersey** are all `"correct"` (conference and division do not affect the win). `comparePlayers` returns `{ result, isWinner }`.

### 4.3 Attempts & scoring

- Maximum of 6 guesses.
- Score table indexed by attempt number: `[100, 80, 60, 40, 20, 10, 0]`; attempt 1 → 100, attempt 6 → 10. A loss scores `0`.
- The persisted session is the single source of truth for game state. `isFinished` and `secretPlayer` are derived from the persisted session's `isFinished` flag and are revealed whenever the game ends (win or loss, including an early win).
- `attempts` increments on every accepted guess and reaches `6` on a loss on the 6th attempt.
- On a correct guess within 6 attempts, the session is updated with `attempts`, `isFinished: true`, `isWin: true`, and the computed `score`.
- If the 6th guess is wrong, the session is finalized with `attempts: 6`, `isFinished: true`, `isWin: false`, `score: 0`.
- A session whose persisted `isFinished` flag is `true` rejects further guesses with `"Game already finished"` (400). `Guess.result` persists the hint object (not a boolean).

**Resolved by spec 002** (was known inconsistency/quirk): (1) `Guess.result` now persists the hint object; (2) `isFinished`/`secretPlayer` derived from persisted session; (3) finished sessions reject further guesses; (12) `attempts` tracked per accepted guess via atomic updates.

### 4.4 Guess response shape

`makeGuessService` returns:

```json
{
  "player": "string",
  "position": "string",
  "jersey": 0,
  "team": "string",
  "conference": "string",
  "division": "string",
  "result": { "team": "...", "position": "...", "jersey": "...", "conference": "...", "division": "..." },
  "isWinner": false,
  "score": 0,
  "isFinished": false,
  "secretPlayer": ""
}
```

### 4.5 Daily game

`getDailyGameService` derives today's date as `YYYY-MM-DD` (UTC) and looks up a `DailyGame` by date. If none exists, it picks a random player and creates one. It always returns `{ dailyGameId }`.

### 4.6 Player listing

- `GET /api/players` — all players.
- `GET /api/players/random` — one random player.
- `GET /api/players/search?q=` — case-insensitive `contains` match on `name`, up to 10 results, selecting `id`, `name`, `position`, and `team.name`. Empty/missing `q` returns `[]`.

## 5. Frontend Behavior

### 5.1 Landing page (`/`)

Static landing page with a styled "Start Game" button linking to `/game`.

### 5.2 Game page (`/game`)

- Starts a game via `POST {API}/api/game/start` on mount and stores `gameId`.
- Submits guesses via `POST {API}/api/game/:id/guess` with `{ playerId }`.
- Appends each response to a local `guesses` array.
- Renders a header row (Player, Team, Position, Jersey, Conference, Division).
- Shows a green win banner when any guess has `isWinner`, or a red loss banner with the secret name when the last guess has `isFinished`.
- Disables the input after the game finishes.
- "New Game" button reloads the page.
- Attempt counter shows `guesses.length / 6`.

### 5.3 PlayerInput

- Debounced (300 ms) search against `/api/players/search?q=`.
- Requires at least 2 characters before searching.
- Keyboard navigation: ↑/↓ to move the selection, Enter to submit the selected player.
- Click on a result also submits.
- After submitting, the query and results are cleared.

### 5.4 GuessRow

Maps hint values to colors:
- `"correct"` → green.
- `"incorrect"`, `"lower"`, `"higher"` → gray.
- anything else → yellow.

The jersey cell appends `<` when the hint is `"higher"` and `>` when `"lower"`.

## 6. Seed

`prisma/seed.ts`:
1. Upserts 32 NFL teams (plus an `Undefined` fallback team) by name.
2. Fetches `https://api.sleeper.app/v1/players/nfl`.
3. Filters players to those with a `team` and position `!== "DEF"`.
4. Bulk-inserts players via `createMany` with `skipDuplicates`, mapping `teamId` from the team abbreviation (`abr`) or `33` fallback.

Requires network access and `DATABASE_URL`.

## 7. Known Inconsistencies & Quirks

Documented as current behavior (not yet fixed):

1. **`Guess.result` stores a boolean.** The schema declares `result Json`, but `makeGuessService` writes `isWinner` (a boolean) into it rather than the hints object.
2. **`isFinished`/`secretPlayer` are guess-count based.** The guess response computes `isFinished: guessCount == 5` and reveals `secretPlayer` on that basis, not from the persisted session state.
3. **No guard against guessing after the game ends.** Only `guessCount > 5` blocks requests; a session that was already won/lost can still receive more guesses. The error handler handles `"Game already finished"`, but the service never throws it.
4. **`GET /api/game/:id` hides failures in the body.** `getGameService` returns `{ error: "Game not found" }` with HTTP 200 instead of throwing, so the error middleware's 404 path is not exercised here.
5. **Error middleware registered after `app.listen`.** `app.use(errorHandler)` is called after the server starts listening; ordering is unusual though it still catches errors for later requests.
6. **Route handler return values.** Some handlers `return res.json(...)`; others rely on `asyncHandler`. Behavior is consistent but inconsistent in style.
7. **Unused Nest scaffold and e2e test.** `main.ts`, `app.module.ts`, `src/prisma/*`, and `test/app.e2e-spec.ts` do not reflect the running Express app; the e2e test expects a `Hello World!` route that does not exist.
8. **Daily/leaderboard endpoints are backend-only.** The frontend does not call `GET /api/game/daily/today` or `GET /api/game/leaderboard/top`.
9. **`GameSession` has no timestamps or player/session ownership**, and there is no authentication; sessions are anonymous and never expire.
10. **Seed data typos.** Team names include `"Pittsburg Steelers"`, `"Tampa Bay Buccanners"`, and `"Tennesse Titans"`.
11. **Env filename mismatch in docs.** The README references `frontend/.env.local`, while the project actually uses `frontend/.env`.
12. **`attempts` may lag on losses.** On a losing final guess the service sets `attempts: 6`; on intermediate wrong guesses `attempts` is not incremented.

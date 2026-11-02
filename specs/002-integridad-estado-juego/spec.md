# 002 — Game State Integrity Specification

## Objetivo (Objective)

Make the **persisted game session the single source of truth** for a game's state. This spec corrects points 1, 2, 3, and 12 of the "Known Inconsistencies & Quirks" section in `specs/001-estado-actual/spec.md`, which share a common root cause: the guess response derives game state from the guess count instead of the persisted session.

## Contexto y problema (Context & Problem)

- Guiding principles: `specs/constitution.md`.
- Current behavior baseline: `specs/001-estado-actual/spec.md`, especially section 7.
- The relevant code paths are `backend/src/services/game.service.ts` (`makeGuessService`, `comparePlayers`), the Prisma schema `backend/prisma/schema.prisma`, `backend/src/middleware/error.middleware.ts`, and the frontend `frontend/app/game/page.tsx` and `frontend/app/components/GuessRow.tsx`.

Four observed defects, with a single shared cause (persisted state is not authoritative):

1. `Guess.result` is declared as `Json` but is written as a boolean (`isWinner`), not the hint object.
2. `isFinished` and `secretPlayer` in the response are computed from `guessCount` rather than the session's persisted state. A win on attempts 1–5 therefore reports `isFinished: false`.
3. A session that is already won or lost still accepts new guesses; the service never signals `"Game already finished"` even though the error handler already maps it.
4. `attempts` is only written on a win or on the final loss, so it lags during a game and does not reflect the number of attempts made.

## Reglas de negocio (Business Rules)

- **Exactly six attempts.** The game allows a maximum of six guesses; the 6th attempt is the last one, and processing it always ends the game.
- **Finished state.** A game is **finished** when the persisted session's `isFinished` flag is `true`. This persisted flag — not the number of attempts in a response — is the authoritative indicator that the game has ended, whether by a win or by a loss.
- A guess is a **win** only when team, position, and jersey are all `"correct"`. Conference and division do not affect the win.
- Per-attribute hint values are exactly `"correct" | "incorrect" | "higher" | "lower"` (jersey is numeric high/low).
- Score by attempt number uses `[100, 80, 60, 40, 20, 10, 0]`: attempt 1 → 100, attempt 6 → 10. A loss scores `0`.
- The secret player is revealed only once the game has ended (win or loss), including a win before the 6th attempt.

## Requisitos funcionales (Functional Requirements)

- **RF-1** — `Guess.result` persists the **hint object** (`team`, `position`, `jersey`, `conference`, `division` with the hint enum values), matching the `Json` type declared in the schema — not a boolean.
- **RF-2** — `isFinished` and `secretPlayer` in the guess response are derived from the persisted session's `isFinished` flag, not from the guess count. When the persisted flag is `true`, the response `isFinished` is `true` and `secretPlayer` exposes the secret's name; otherwise `isFinished` is `false` and `secretPlayer` is the empty string `""`.
- **RF-3** — A session whose persisted `isFinished` flag is `true` (already won or lost) rejects further guesses with the error `"Game already finished"` (the existing error handler maps this to HTTP 400).
- **RF-4** — `attempts` increments on **every** accepted guess and reaches `6` when the game is lost on the 6th attempt.
- **RF-5** — Processing a guess is **atomic**: counting the prior attempts, updating the session, and inserting the new guess occur as a single unit.

> **Note (justifies RF-5).** Today these three operations are separate and non-atomic in `makeGuessService`, so near-simultaneous guesses can observe the same pre-guess state and race. RF-5 requires them to be a single unit so that `attempts` stays consistent (AC-6) and no guess is accepted after the game finishes (AC-4/AC-5). No automated concurrent-test criterion is required by this spec.

## Criterios de aceptación (Acceptance Criteria)

All criteria are Given/When/Then and verifiable with automated tests (Jest + supertest against the exported `app`, requiring a seeded database).

- **AC-1 — Win on attempt 1.** Given a new game whose secret is known to the test, When the first guess is the secret player, Then `isWinner` is `true`, the response `isFinished` is `true` (so the frontend disables further input), the session is persisted with `isWin: true`, `attempts: 1`, `score: 100`, and the response reveals the secret player.
- **AC-2 — Win on attempt 6.** Given a game where the first five guesses are wrong, When the 6th guess is the secret player, Then `isWinner` is `true`, `attempts` is `6`, `score` is `10`, `isFinished` is `true`, and the response reveals the secret player.
- **AC-3 — Loss on attempt 6.** Given a game where the first five guesses are wrong, When the 6th guess is wrong, Then the session's persisted `isFinished` flag is `true` with `isWin: false`, `attempts: 6`, `score: 0`, the response `isFinished` is `true`, and the response reveals the secret player.
- **AC-4 — Guess after winning.** Given a game whose persisted `isFinished` flag is `true` because it was won, When a new guess is submitted, Then the request is rejected with the error `"Game already finished"` (HTTP 400), no new guess is persisted, and the session's `attempts` does not change.
- **AC-5 — Guess after losing.** Given a game whose persisted `isFinished` flag is `true` because it was lost, When a new guess is submitted, Then the request is rejected with the error `"Game already finished"` (HTTP 400), no new guess is persisted, and the session's `attempts` does not change.
- **AC-6 — Attempts consistency.** Given a game in progress, When guesses are submitted one at a time, Then the persisted `attempts` equals the number of accepted guesses (`1`, then `2`, then `3`, ...) after each guess.
- **AC-7 — Persisted result shape.** Given any accepted guess, When the guess row is persisted, Then its `result` is a JSON object containing the keys `team`, `position`, `jersey`, `conference`, and `division` whose values are members of the hint enum, and it is not a boolean.
- **AC-8 — State derived from the session.** Given any guess that ends the game (a win on attempts 1–6, including a win before the 6th attempt, or a loss on attempt 6), When the response is built, Then `isFinished` is `true` and `secretPlayer` is the secret's name, both derived from the persisted session's `isFinished` flag.
- **AC-9 — In-progress derivation.** Given a guess that does not end the game, When the response is built, Then `isFinished` is `false` and `secretPlayer` is the empty string `""`.

## Casos límite (Edge Cases)

- **Validation precedence.** Rejections occur in this order: invalid input (400, Zod) → game not found → game finished (`"Game already finished"`, 400) → player not found. The first applicable check wins.
- **Win on the 6th attempt scores 10**, not 0, per the score table; a loss on the 6th attempt scores 0.
- **Same player guessed twice.** Repeating a player is allowed while the game is in progress and counts as an attempt; no special handling beyond the normal rules.
- **Double submission / concurrency.** Two guesses arriving near-simultaneously must not both be accepted against stale state; this is covered by RF-5, and no automated concurrent-test criterion is required.
- **Invalid `playerId`.** A non-positive or non-integer `playerId` is rejected with a 400 validation error (Zod `guessSchema`), unchanged.
- **Game not found / Player not found.** These retain their current responses and are not changed by this spec.
- **Attempts at the maximum with the session not marked finished.** This state must not be reachable for newly played games after this spec; if encountered, the game is treated as finished.

## Impacto en el contrato de API (API Contract Impact)

- `POST /api/game/:id/guess` now returns a truthful `isFinished` and exposes `secretPlayer` whenever the game ends (a win on attempts 1–6 or a loss on attempt 6), instead of only on the 6th guess.
- A new response is added for guessing after the game ends: HTTP `400` with `{ "error": "Game already finished" }`.
- The shape of the `result` object in the response is unchanged; only the **persisted** `Guess.result` representation changes (internal).
- `POST /api/game/start`, `GET /api/game/:id`, the daily and leaderboard endpoints, and the player endpoints are unchanged.

## Impacto en datos existentes (Existing Data Impact)

- **`Guess.result` holds booleans** in existing rows. No backend code reads this column (not the leaderboard, not any game endpoint), so **legacy rows are left as-is and ignored**; the new hint-object format applies only to guesses persisted from now on. No backfill or reset is required, and the column type is already `JSONB` (no schema migration for RF-1).
- **`GameSession.attempts` may be inaccurate** for older sessions (it was only set on win/loss), so historical sessions may show `attempts: 0` despite having guesses. Resolved: The reconciliation script also sets isFinished = true for every session where isWin is true or the reconciled attempts is >= 6.
- No changes to the Prisma schema or to applied migrations are required by this spec.

## Fuera de alcance (Out of Scope)

- HTTP 200 responses shaped as `{ error }` on `GET /api/game/:id`, error-middleware ordering, and handler style (deferred to spec 003).
- NestJS scaffold cleanup, seed typos, and README fixes (deferred to spec 004).
- Timestamps, authentication, session expiration, daily mode, and leaderboard behavior.

## Decisiones abiertas (Open Decisions)

### Resolved during this revision

1. **Legacy boolean `Guess.result` rows** — Resolved: left as-is and ignored; the new format applies forward. Verified that no backend code reads the column.
2. **Legacy `GameSession.attempts`** — Resolved: reconciled by a one-time script that sets `attempts` equal to the number of guesses persisted for the session.
3. **Secret reveal on early wins** — Resolved: `secretPlayer` is revealed whenever the game ends, including wins before the 6th attempt.
4. **Concurrency approach (former decision 4)** — Superseded by RF-5 and its note; no separate open decision remains.
5. **Where `"Game already finished"` is raised** — Moved out of this spec as an implementation decision; it belongs in `plan.md`.

### Still open

- **Frontend dependency:** the frontend consumes `isFinished`, `secretPlayer`, and the `result` object exclusively from the HTTP response (`frontend/app/game/page.tsx:38-66`, `frontend/app/components/GuessRow.tsx:15-19`) and never reads the persisted `Guess.result`; any change to the persisted representation must not alter the response shape.
- **Error responses with 200 status (spec 003):** returning `{ "error": "Player not found" }` with HTTP 200 and returning `{ "error": "Game not found" }` / similar `{ error }` shapes with non-error status codes are inconsistent with proper HTTP semantics. The `secret` lookup returning null is also treated defensively (200 `{ error: "Game not found" }`) in the current implementation; these are candidates for review and normalization in spec 003. The 200 response with `"Player not found"` is currently preserved by `game.test.ts` and T-09 and will be revisited in spec 003.

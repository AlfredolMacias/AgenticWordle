# 003 — API Contract & Error Handling Specification

## Objective

Normalize API error responses and middleware ordering to use proper HTTP semantics. Address points 4, 5, and 6 of `specs/001-estado-actual/spec.md` §7 and the follow-ups from spec 002 (200 responses with `{ error }` for `"Player not found"` and for secret-null/Game-not-found edge cases).

## Context & Problem

Current issues:
- `getGameService` returns `{ error: 'Game not found' }` with HTTP 200 (point 4). Error middleware 404 path not exercised.
- `app.use(errorHandler)` registered after `app.listen` (point 5).
- Route handlers have inconsistent style (some return, some rely on asyncHandler) (point 6).
- `makeGuessService` returns `{ error: 'Player not found' }` with HTTP 200 (spec 002 follow-up).
- When `secret` lookup returns null in `makeGuessService`, returns `{ error: 'Game not found' }` with HTTP 200 (spec 002 follow-up).
- Frontend `app/game/page.tsx:34-37` currently renders empty on `{error}` responses.

## Business Rules

- Use proper HTTP status codes: 400 for bad input/validation/game-already-finished, 404 for not found resources, 500 for unexpected errors.
- Error responses should be consistent: `{ "error": "<message>" }` (and include `details` for Zod validation errors as before).
- Throw errors from services where appropriate so they flow to error middleware; or have controllers handle consistently.
- Preserve existing behavior where reasonable except for the inconsistent 200-with-error cases.

## Functional Requirements

- **RF-1** — `GET /api/game/:id`: when game not found, return HTTP 404 with `{ "error": "Game not found" }` (via error middleware or consistent handling).
- **RF-2** — `POST /api/game/:id/guess`: when `playerId` refers to non-existent player, return HTTP 404 with `{ "error": "Player not found" }` (or appropriate status; prefer 404 consistent with "not found" resources).
- **RF-3** — `POST /api/game/:id/guess`: when `secret` lookup fails (null), treat as game/resource not found and return HTTP 404 with `{ "error": "Game not found" }`.
- **RF-4** — Move `app.use(errorHandler)` before or properly registered so it handles errors correctly (register before `app.listen` or ensure it's the last middleware; in Express, error handlers must be registered after routes/middleware that may call `next(err)`). Fix ordering (point 5).
- **RF-5** — Standardize route handler patterns to be consistent (prefer explicit returns, use `asyncHandler` or try/catch consistently). Document/conform style.

## Acceptance Criteria

- **AC-1** — `GET /api/game/:id` with invalid id returns 404 `{ error: "Game not found" }`.
- **AC-2** — `POST /api/game/:id/guess` with non-existent `playerId` returns 404 `{ error: "Player not found" }` (not 200).
- **AC-3** — `POST /api/game/:id/guess` when secret missing returns 404 `{ error: "Game not found" }` (not 200).
- **AC-4** — Error middleware is properly registered (errors flow correctly; tests verify status codes).
- **AC-5** — Frontend handles 404/400 errors appropriately (update `app/game/page.tsx` to show error messages instead of rendering empty on `{error}`).

## API Contract Impact

- Changes status codes for error cases: `GET /api/game/:id` game not found → 404 (was 200). `makeGuess` player not found → 404 (was 200). Secret null → 404 (was 200).
- Error response bodies remain `{ error: ... }`.
- Other endpoints unchanged.

## Frontend Impact

- `frontend/app/game/page.tsx` must handle error responses (check `res.ok` or response shape) and display appropriate messages.
- `frontend/app/components/GuessRow.tsx` unchanged.

## Out of Scope

- NestJS scaffold cleanup (spec 004).
- Daily/leaderboard UI (spec 005).
- Timestamps/auth (spec 006).
- Design changes beyond error handling (spec 007).

## Open Decisions

- Should `"Player not found"` be 404 or 400? "Not found" suggests 404; validation of id format is 400. Prefer 404 for resource not found.
- Should we use `asyncHandler` wrapper everywhere for consistency?
- How to structure controller/service error flow (throw vs return objects)?

(End of file)

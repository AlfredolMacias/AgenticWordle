# API Contract — 003 Contract & Errors

Status: contract for spec 003 (API contract & error handling).

**Verification basis.** The **Current** columns below describe the base branch `main` (the deployed behavior), verified with `git show main:<path>`; file:line references point at that base snapshot. The **Target** columns describe the agreed outcome of spec 003. Anything outside the spec 003 scope is marked `unchanged`.

## Scope

In scope for spec 003 only:

1. `GET /api/game/:id` currently returns HTTP 200 with `{ error }`.
2. `POST /api/game/:id/guess`: `"Player not found"` and the null-secret check currently return HTTP 200 with `{ error }`.
3. The frontend renders empty on any `{ error }` body (including 400/404).
4. Error middleware registration order relative to `app.listen`.
5. Inconsistent handler style (`asyncHandler` in game routes vs route-level try/catch in players routes).

Everything else is `unchanged`.

## 1. Global conventions

### 1.1 Error response shape

| Aspect | Current (base `main`) | Target (spec 003) |
|---|---|---|
| Error body | `{ error: string }`. | `{ error: string }` — **unchanged (RESOLVED)**. |
| Validation errors | `{ error: "Validation error", details: <string> }`, HTTP 400 (`backend/src/middleware/error.middleware.ts:11-16`). `details` is currently exposed. | Keep `details` because it exists today (**RESOLVED**). Status stays 400. |
| Route-level errors in players | `{ error: "Error fetching players" }` / `{ error: "Error selecting player" }`, HTTP 500 (`backend/src/routes/players.ts:6-13,15-23`). | Move to centralized middleware while preserving status and `{ error }` shape; exact strings preserved unless baseline tests show a conflict (**RESOLVED**, see §3). |
| Unexpected errors | `{ error: "Internal Server Error" }`, HTTP 500; detail logged only (`backend/src/middleware/error.middleware.ts:25-32`). | **Unchanged (RESOLVED)**: generic body, detail only in the log. This becomes the target for a null secret too (§2.2). |

### 1.2 Status code policy

| Aspect | Current (base `main`) | Target (spec 003) |
|---|---|---|
| Malformed request | 400 via Zod (`.parse`) (`backend/src/controllers/game.controller.ts:28`, `backend/src/validations/game.validation.ts:3-5`). | 400 for malformed requests — **unchanged (RESOLVED)**. |
| Well-formed reference to a missing entity | Mixed: some paths return HTTP 200 with `{ error }` instead of an error status (§2.2, §2.3). | 404 for a well-formed reference to an entity that does not exist (**RESOLVED**). |
| `"Game not found"` | 404 only if thrown (`error.middleware.ts:18-20`); `getGameService`/`makeGuessService` return it as a 200 body instead (`game.service.ts:60-62,106-108,151-153`). | 404 in both `GET /api/game/:id` and `POST /api/game/:id/guess` (**RESOLVED**). |
| `"Player not found"` | Not mapped in middleware; returned as a 200 body (`game.service.ts:131-133`). | 404 (**RESOLVED**). |
| `"Game already finished"` | 400 (thrown `game.service.ts:110-112`; mapped `error.middleware.ts:21-23`). | 400 — **unchanged**. |
| Null secret in a session | Returned as 200 `{ error: "Game not found" }` (`game.service.ts:151-153`). | HTTP 500 with the generic `{ error: "Internal Server Error" }`; detail only in the log. It is a data inconsistency, not "not found" (**RESOLVED**). |

### 1.3 Validation

| Aspect | Current (base `main`) | Target (spec 003) |
|---|---|---|
| Guard | `guessSchema = z.object({ playerId: z.number().int().positive() })` (`backend/src/validations/game.validation.ts:3-5`). | **Unchanged (RESOLVED)**. |
| Entry point | Controller calls `guessSchema.parse(req.body)` (`game.controller.ts:28`); a `ZodError` is forwarded by `asyncHandler` (`backend/src/routes/game.ts:15`) to the error handler. | **Unchanged**. Zod remains the first check (precedence). |
| Response | 400 `{ error: "Validation error", details: <string> }`. | 400, same body. |

### 1.4 Middleware registration order

| Aspect | Current (base `main`) | Target (spec 003) |
|---|---|---|
| Routes | `app.use('/api/players', ...)` and `app.use('/api/game', ...)` (`backend/src/server.ts:28-29`). | **Unchanged**. |
| Server start | `app.listen(...)` (`backend/src/server.ts:33-35`). | **Unchanged**. |
| Error handler | `app.use(errorHandler)` registered **after** `app.listen(...)` (`backend/src/server.ts:37`). | Register `errorHandler` **before** `app.listen(...)` and after all routes (`app.use(errorHandler)` then `app.listen(...)`) (**RESOLVED**). |
| Verification | None. | Add a test that a real thrown error passes through the handler and responds JSON `{ error }` with the correct status (**RESOLVED**). |

### 1.5 Handler style

| Aspect | Current (base `main`) | Target (spec 003) |
|---|---|---|
| Game routes | `asyncHandler(...)` wrappers (`backend/src/routes/game.ts:13,15,17,19,21`); controllers are plain async functions without `next` (`game.controller.ts:11-39`). | Keep `asyncHandler`; controllers signal errors by throwing (or by returning service errors that are thrown at the service boundary), so the middleware owns the response. |
| Players routes | Inline handlers with local `try/catch` for `/` and `/random`; `/search` has no `try/catch` (`backend/src/routes/players.ts:6-52`). | Move to `asyncHandler` + centralized middleware. **Requires prior tests of the players routes** so their current error status/shape is captured before the refactor (**RESOLVED**). |
| `getGameService` | Returns `{ error: "Game not found" }` (`game.service.ts:60-62`). | Throw `"Game not found"`; middleware responds 404 (**RESOLVED**). |

## 2. Endpoints

### 2.1 `POST /api/game/start`

- **Purpose:** create a new game session (`backend/src/routes/game.ts:13`, `backend/src/controllers/game.controller.ts:11-14`, `backend/src/services/game.service.ts:40-52`).
- **Parameters / validation:** none.
- **Success:** HTTP 200, the created `GameSession` object.
- **Errors:** any thrown error → `asyncHandler` → error middleware → 500 `{ error: "Internal Server Error" }` unless mapped (no dedicated mapping in base).
- **Frontend consumer:** `frontend/app/game/page.tsx:12-18` (POST, reads `data.id`). No error handling; an error body would set `gameId` to `undefined`/be ignored.
- **Current vs Target:** Current as verified. Target: `unchanged` (outside spec 003; generic error behavior follows §1.1).

### 2.2 `POST /api/game/:id/guess`

- **Purpose:** submit a guess (`backend/src/routes/game.ts:15`, `backend/src/controllers/game.controller.ts:26-33`, `backend/src/services/game.service.ts:101-256`).
- **Parameters / validation:** `id` path param converted with `Number` (`game.controller.ts:27`); body `{ playerId }` validated by `guessSchema` (`z.number().int().positive()`).
- **Success:** HTTP 200 with
  `{ player, position, jersey, team, conference, division, result: { team, position, jersey, conference, division }, isWinner, score, isFinished, secretPlayer }`
  (`game.service.ts:243-255`); `secretPlayer` is the secret's name when finished, otherwise `""`.
- **Errors — Current (base `main`), in precedence order:**
  1. 400 `{ error: "Validation error", details: <string> }` — Zod parse failure (`game.controller.ts:28`; `error.middleware.ts:11-16`).
  2. **200** `{ error: "Game not found" }` — session id does not exist; service **returns**, does not throw (`game.service.ts:106-108`; `game.controller.ts:31-32`).
  3. 400 `{ error: "Game already finished" }` — session finished; service throws (`game.service.ts:110-112`; `error.middleware.ts:21-23`).
  4. **200** `{ error: "Player not found" }` — `playerId` does not exist; service returns (`game.service.ts:131-133`).
  5. **200** `{ error: "Game not found" }` — the session's `secretPlayerId` resolves to no player; service returns (`game.service.ts:151-153`).
  6. 500 `{ error: "Internal Server Error" }` — any other thrown error (`error.middleware.ts:25-32`).
- **Errors — Target (spec 003):**
  1. 400 `{ error: "Validation error", details: <string> }` — `unchanged`.
  2. 404 `{ error: "Game not found" }` — session id does not exist (RESOLVED).
  3. 400 `{ error: "Game already finished" }` — `unchanged`.
  4. 404 `{ error: "Player not found" }` — RESOLVED.
  5. 500 `{ error: "Internal Server Error" }` — null secret (data inconsistency; detail only in the log) (RESOLVED).
  6. 500 `{ error: "Internal Server Error" }` — any other thrown error (`unchanged`).
- **Frontend consumer:** `frontend/app/game/page.tsx:20-37`. POSTs `{ playerId }`; reads JSON unconditionally; appends the body to `guesses`; then `guesses.findLast(g => g.error)` (line 34) causes an early `return (<></>)` (lines 35-37), i.e. the **whole page renders empty on any error body**, regardless of status. There is no `res.ok` check.
- **Current vs Target:** Current as verified. Target: statuses/bodies as in the Target error list; success body `unchanged`.

### 2.3 `GET /api/game/:id`

- **Purpose:** fetch a game session (`backend/src/routes/game.ts:17`, `backend/src/controllers/game.controller.ts:35-39`, `backend/src/services/game.service.ts:54-65`).
- **Parameters / validation:** `id` converted with `Number`; no Zod validation.
- **Success:** HTTP 200, the `GameSession` object.
- **Errors — Current (base `main`):** not found → **200** `{ error: "Game not found" }` (service returns at `game.service.ts:60-62`; controller `res.json` at `game.controller.ts:38`). Other errors → 500 generic.
- **Errors — Target (spec 003):** not found → **404** `{ error: "Game not found" }`; the service throws and the middleware responds 404 (RESOLVED). Other errors: 500 generic (`unchanged`).
- **Frontend consumer:** none (no call to `/api/game/:id` in `frontend/app`).
- **Current vs Target:** the only change is the not-found status 200 → 404.

### 2.4 `GET /api/game/daily/today`

- **Purpose:** get or create today's daily game (`backend/src/routes/game.ts:19`, `backend/src/controllers/game.controller.ts:16-19`, `backend/src/services/game.service.ts:80-99`).
- **Parameters / validation:** none.
- **Success:** HTTP 200 `{ dailyGameId: number }`.
- **Errors:** thrown errors → middleware → 500 generic (no dedicated mapping).
- **Frontend consumer:** none.
- **Current vs Target:** `unchanged` (outside spec 003).

### 2.5 `GET /api/game/leaderboard/top`

- **Purpose:** top finished games (`backend/src/routes/game.ts:21`, `backend/src/controllers/game.controller.ts:21-24`, `backend/src/services/game.service.ts:67-78`).
- **Parameters / validation:** none.
- **Success:** HTTP 200, array of `GameSession` (finished, non-null score, ordered by score desc, max 10).
- **Errors:** thrown errors → middleware → 500 generic.
- **Frontend consumer:** none.
- **Current vs Target:** `unchanged` (outside spec 003).

### 2.6 `GET /api/players`

- **Purpose:** list all players (`backend/src/routes/players.ts:6-13`).
- **Parameters / validation:** none.
- **Success:** HTTP 200, array of `Player`.
- **Errors — Current:** route-level `catch` → 500 `{ error: "Error fetching players" }`.
- **Errors — Target:** migrate to `asyncHandler` + centralized middleware, preserving HTTP 500 and `{ error }` body (message preserved unless a documented decision changes it). **Requires baseline tests of this route before the refactor** (RESOLVED).
- **Frontend consumer:** none.
- **Current vs Target:** internal handler style only; contract preserved.

### 2.7 `GET /api/players/random`

- **Purpose:** one random player (`backend/src/routes/players.ts:15-23`).
- **Parameters / validation:** none.
- **Success:** HTTP 200, one `Player`.
- **Errors — Current:** route-level `catch` → 500 `{ error: "Error selecting player" }`.
- **Errors — Target:** `asyncHandler` + centralized middleware, preserving HTTP 500 and `{ error }`. **Requires baseline tests before the refactor** (RESOLVED).
- **Frontend consumer:** none.
- **Current vs Target:** internal handler style only; contract preserved.

### 2.8 `GET /api/players/search?q=`

- **Purpose:** case-insensitive name search (`backend/src/routes/players.ts:25-52`).
- **Parameters / validation:** `q` string; missing/empty → `[]` (200). No Zod.
- **Success:** HTTP 200, array (max 10) of `{ id, name, position, team: { name } }`.
- **Errors — Current:** no local `try/catch`; a rejected Prisma promise is forwarded by Express 5 to the error middleware → 500 `{ error: "Internal Server Error" }` (runtime behavior **unverified**).
- **Errors — Target:** `asyncHandler` + centralized middleware, same status/shape; **requires baseline tests before the refactor** (RESOLVED).
- **Frontend consumer:** `frontend/app/components/PlayerInput.tsx:26` (debounced) and `:77` (direct helper); both read JSON into `results` and assume an array. No error handling; an error body would render incorrectly.
- **Current vs Target:** contract `unchanged`; handler style only.

## 3. Changes introduced by spec 003

| Endpoint / area | Change (Target) | Impact on frontend | Breaking? |
|---|---|---|---|
| `GET /api/game/:id` (not found) | 200 `{ error: "Game not found" }` → 404 `{ error: "Game not found" }`; service throws. | None today (not consumed). Future consumers must treat 404 as not found. | **Yes** for any API client relying on the 200 body. |
| `POST /api/game/:id/guess` — session not found | 200 `{ error: "Game not found" }` → 404 `{ error: "Game not found" }`. | `GamePage` currently blanks the page on any `{ error }`; must handle the error explicitly. | **Yes**. |
| `POST /api/game/:id/guess` — player not found | 200 `{ error: "Player not found" }` → 404 `{ error: "Player not found" }`. | Same as above. | **Yes**. |
| `POST /api/game/:id/guess` — null secret | 200 `{ error: "Game not found" }` → 500 `{ error: "Internal Server Error" }` (detail logged). | Must surface a generic server error, not "not found". | **Yes** (status and body). |
| `POST /api/game/:id/guess` — validation / finished | No change (400 with `details`; 400 `Game already finished`). | None. | No. |
| Global middleware order | Register `errorHandler` before `app.listen` (still after routes); add an integration test proving a thrown error yields JSON `{ error }` with the correct status. | No functional change expected. | No (assuming the test passes). |
| `GET /api/players`, `/random`, `/search` | Move to `asyncHandler` + centralized middleware; preserve current status and `{ error }` shape. **Blocked on baseline route tests.** | Only `/search` is consumed; behavior unchanged. | No, **provided** baseline tests confirm identical status/shape. |
| Frontend error handling (`GamePage`) | Stop rendering an empty page on error; show a message and an available action. | `frontend/app/game/page.tsx`. | No (UX improvement). |
| All other endpoints | `unchanged`. | — | No. |

## 4. Compatibility and deployment order

Backend and frontend deploy separately. The chosen strategy is **expand / contract**:

1. **Expand — frontend first (tolerant).** Deploy a frontend that accepts **both** shapes: legacy `200 { error }` and the new `4xx/5xx { error }`. Detect failure from either `res.ok === false` or the presence of `error`, and surface a message instead of blanking the page. At this point the backend still returns the legacy 200s.
2. **Deploy backend.** Switch to the new statuses: 404 for `Game not found` / `Player not found`, 500 for null secret, unchanged 400s, and the fixed middleware order.
3. **Contract — frontend cleanup.** Once the backend is fully rolled out (and rollback risk accepted), remove the legacy `200 { error }` handling from the frontend.

Incompatibilities and considerations:

- **Backend-first is unsafe:** the current `GamePage` appends every body and then blanks the page on `{ error }` without checking `res.ok`, so it cannot distinguish a legacy 200 error from a successful guess.
- **During phases 1–2**, the tolerant frontend must not treat a legacy `200 { error }` as a successful guess (it must not append it to `guesses`).
- `GET /api/game/:id`, `/api/game/daily/today`, `/api/game/leaderboard/top`, `/api/players`, and `/api/players/random` are **not consumed** by the frontend, so their status changes need no frontend coordination.
- The null-secret 500 must not be presented as "not found"; use a generic server-error message.
- **Rollback tolerance:** the tolerant frontend works with both backends. After phase 3, rolling the backend back to legacy 200 errors would break the cleaned-up frontend, so treat phase 3 as dependent on backend stability.
- **Not chosen:** atomic deployment of both sides, and backend-first behind a compatibility shim (no shim is planned).

## 5. Open decisions

Only items that remain undecided after the spec 003 decisions are listed here.

### 5.1 Frontend UX for 404 / 400 / 500

How should the game page present an error and what action(s) should be available? Options (not decided):

- **A. Inline persistent banner above the board**, with a status-appropriate message and actions such as "Try again" (re-submit the last `playerId`) and "New game".
  - Pros: non-modal, accessible, keeps the board/context visible; supports retry.
  - Cons: most UI work; needs state for the failed guess.
- **B. Keep the browser `alert()` pattern**, message plus the existing "New Game" button.
  - Pros: minimal change.
  - Cons: blocking, poor mobile/accessibility, no in-page retry.
- **C. Terminal error state replacing the board**, with the message and a "New game" action.
  - Pros: simple and unambiguous.
  - Cons: hides prior guesses unless deliberately preserved; no retry of the last guess.
- **D. Toast/snackbar**, non-blocking, input re-enabled.
  - Pros: unobtrusive.
  - Cons: transient and easy to miss; requires introducing a toast mechanism.

Sub-questions to resolve with the chosen option:

- Map status to message (400 = invalid guess, 404 = unknown game/player, 500 = server error), or always display the server's `error` string?
- Should "Try again" re-submit the same `playerId`, or require the user to search again?
- Where the error belongs: guess submission only, or also the `POST /api/game/start` failure that currently leaves the page without a game?
- Should `PlayerInput` search failures (`/api/players/search`) be surfaced too, or stay silent?

## Appendix A — Resolved decisions (spec 003)

1. **Error shape:** keep `{ error: string }`; keep `details` on validation errors because it exists today.
2. **Status rule:** 400 = malformed request; 404 = well-formed reference to a nonexistent entity.
3. **`Player not found`:** 404.
4. **`Game not found`:** 404 in both `GET /api/game/:id` and `POST /api/game/:id/guess`.
5. **Null secret:** 500 with the generic `{ error: "Internal Server Error" }`; detail only in the log (data inconsistency, not "not found").
6. **`GET /api/game/:id`:** the service throws and the middleware responds 404.
7. **Players routes:** move to `asyncHandler` + middleware; require baseline tests of the players routes before the refactor.
8. **Deployment:** expand/contract — tolerant frontend, then backend, then frontend cleanup.
9. **Middleware:** fix the order and add a test that a real error passes through the handler and returns JSON `{ error }` with the correct status.

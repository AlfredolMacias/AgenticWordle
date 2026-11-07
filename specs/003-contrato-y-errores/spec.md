# 003 - API Contract & Error Handling Specification

## Objetivo (Objective)

Normalize HTTP status codes and error handling across the backend and frontend so that error responses are truthful, consistent, and actionable. This spec corrects points 4, 5, and 6 of the "Known Inconsistencies & Quirks" section in `specs/001-estado-actual/spec.md`, incorporates the follow-up findings from `specs/002-integridad-estado-juego/spec.md` (Open Decisions), and defines the frontend's behavior when errors occur. The backend and frontend deploy separately; this spec defines the transition.

## Contexto y problema (Context & Problem)

- Guiding principles: `specs/constitution.md`.
- Current behavior baseline (base branch `main`): `specs/001-estado-actual/spec.md` (section 7), `specs/003-contrato-y-errores/api-contract.md`, and the code paths `backend/src/server.ts`, `backend/src/middleware/error.middleware.ts`, `backend/src/services/game.service.ts`, `backend/src/controllers/game.controller.ts`, `backend/src/routes/game.ts`, `backend/src/routes/players.ts`, `frontend/app/game/page.tsx`, `frontend/app/components/PlayerInput.tsx`.
- Follows: `specs/002-integridad-estado-juego/spec.md`.

Observed defects on the base branch:

1. **`GET /api/game/:id` returns 200 on not found.** `getGameService` returns `{ error: "Game not found" }` (`game.service.ts:60-62`) and the controller responds with `res.json` (`game.controller.ts:38`), so a missing game is HTTP 200 with an error body.
2. **`POST /api/game/:id/guess` returns 200 for error cases.** A missing session (`game.service.ts:106-108`), a missing `playerId` (`game.service.ts:131-133`), and a session whose secret resolves to null (`game.service.ts:151-153`) all return an `{ error }` body with HTTP 200.
3. **Frontend renders a blank page on any error body.** `GamePage` appends every guess response to state and, if any entry has `error`, returns an empty fragment (`frontend/app/game/page.tsx:33-37`). There is no `res.ok` check and no `catch` for network failures. `PlayerInput` performs search requests with no error handling (`PlayerInput.tsx:26,77`).
4. **Error middleware order.** `app.use(errorHandler)` is registered after `app.listen(...)` (`server.ts:37` vs `:33-35`), which is unreliable ordering for an error handler.
5. **Inconsistent handler style.** Game routes use `asyncHandler` (`routes/game.ts`); players routes use local `try/catch` for `/` and `/random` and have no `try/catch` for `/search` (`routes/players.ts`), producing different error shapes/paths.

## Reglas de negocio (Business Rules)

- **Error body shape.** Error responses use `{ error: string }`. Validation errors keep `details` only because that field exists today: `{ error: "Validation error", details: <string> }` (Zod).
- **Status semantics.** HTTP 400 means a malformed request. HTTP 404 means a well-formed reference to an entity that does not exist.
- **Exact 404 contract strings (part of the contract).** On `POST /api/game/:id/guess`, a missing session returns HTTP 404 with body exactly `{ "error": "Game not found" }`, and a missing `playerId` returns HTTP 404 with body exactly `{ "error": "Player not found" }`. On `GET /api/game/:id`, a missing session returns HTTP 404 with body exactly `{ "error": "Game not found" }`. These exact strings are verified by backend tests and the frontend compares them exactly (see RF-9, RF-13).
- **`"Game not found"` vs `"Player not found"` (404).** `"Game not found"` means the session reference does not exist. `"Player not found"` means the `playerId` reference does not exist (POST guess only). A 404 whose `error` string is not exactly `"Game not found"` or `"Player not found"` is treated by the frontend as a generic error and never as "game does not exist".
- **Null secret is a data inconsistency, not "not found".** A session whose `secretPlayerId` resolves to no player yields HTTP 500 with the generic body `{ error: "Internal Server Error" }`; the diagnostic detail is written only to the server log and never returned to the client.
- **Precedence on `POST /api/game/:id/guess` is unchanged** (spec 002): input validation (400, Zod) -> game not found (404, `"Game not found"`) -> game finished (`"Game already finished"`, 400) -> player not found (404, `"Player not found"`). The null-secret check remains a defensive guard after the player/secret lookups and results in 500.
- **Game rules are unchanged.** Max 6 guesses; hints `"correct" | "incorrect" | "higher" | "lower"`; win requires team + position + jersey; score `[100, 80, 60, 40, 20, 10, 0]`; secret revealed only when the game ends.
- **Frontend never displays backend error text.** The frontend uses its own messages by context and HTTP status. It may read the backend `error` string only to discriminate the exact contract cases `"Game not found"` / `"Player not found"`; it must not render backend error text to the user.
- **Frontend UX on errors (fixed, RESOLVED):**
  - **404 on guess, `error` exactly `"Game not found"`:** show the visible message `Esta partida ya no existe` and a button to start a new game.
  - **404 on guess, `error` exactly `"Player not found"`:** show the brief, non-blocking message `Jugador no encontrado` and keep the input enabled.
  - **404 on guess, any other `error` string:** show the generic message `Algo salió mal. Inténtalo de nuevo.` and keep the input enabled; never show "partida no existe".
  - **500 or network failure on guess:** show the generic message `Algo salió mal. Inténtalo de nuevo.`, re-enable the input, and keep the selected player; the game state already shown on screen is not lost. Do **not** auto-resend the request.
  - **400 on guess:** show the generic message `Solicitud no válida.` and keep the input enabled (not expected from the normal UI).
  - **`POST /api/game/start` failure (5xx, 4xx, or network):** show the generic message `Algo salió mal. Inténtalo de nuevo.` and a `Retry` button that calls start again. Do **not** auto-retry.
  - **`PlayerInput` search failure (network or 5xx):** show a non-blocking message under the input; it disappears on the next successful search. "No results" (empty list) is **not** an error and shows no error message. No auto-retry.

## Requisitos funcionales (Functional Requirements)

### Backend

- **RF-1** - `GET /api/game/:id` returns HTTP 404 with body exactly `{ "error": "Game not found" }` when the session does not exist. The service signals the condition by throwing and the error middleware produces the response.
- **RF-2** - `POST /api/game/:id/guess` returns HTTP 404 with body exactly `{ "error": "Game not found" }` when the session does not exist.
- **RF-3** - `POST /api/game/:id/guess` returns HTTP 404 with body exactly `{ "error": "Player not found" }` when the `playerId` does not exist.
- **RF-4** - `POST /api/game/:id/guess` returns HTTP 500 with body exactly `{ "error": "Internal Server Error" }` when the session's secret player cannot be resolved (null secret). The server logs a diagnostic detail; the response body is generic and does not expose the detail.
- **RF-5** - Validation and finished-state behavior are unchanged: Zod failures return HTTP 400 with `{ "error": "Validation error", "details": <string> }`; a finished game returns HTTP 400 with `{ "error": "Game already finished" }`. Precedence remains validation -> game not found -> game finished -> player not found.
- **RF-6** - The error middleware is registered before `app.listen(...)` and after all routes. A real thrown error reaches the handler and produces a JSON `{ error }` response with the correct status (verified by an automated test).
- **RF-7** - Players routes (`/api/players`, `/api/players/random`, `/api/players/search`) are moved to `asyncHandler` + centralized error middleware, using the same handler pattern as the game routes. Their externally visible error contract (HTTP status and `{ error }` body shape) is preserved. `/` and `/random` keep HTTP 500 with the fixed messages `"Error fetching players"` and `"Error selecting player"` respectively (`routes/players.ts:7-13,16-23`). `/search` on internal failure returns HTTP 500 with the generic middleware message `{ "error": "Internal Server Error" }` (RESOLVED OD-5). Baseline tests of the players routes are required before or as part of the refactor to prevent accidental shape changes.

### Frontend

- **RF-8** - The game page (`frontend/app/game/page.tsx`) handles error responses explicitly and never renders a blank page on an `{ error }` body. It detects failures from the HTTP status (`res.ok === false`) and/or an `error` field in the body, and it does not append an error body to the guesses list.
- **RF-9** - `POST /api/game/:id/guess` UI behavior (RESOLVED OD-2, OD-4). The frontend compares the backend `error` string **exactly** to discriminate `"Game not found"` vs `"Player not found"`; it never renders backend error text to the user.
  - status 404 and `error` exactly `"Game not found"` (or, during transition, the legacy 200 form with that exact string): show `Esta partida ya no existe` and a button to start a new game.
  - status 404 and `error` exactly `"Player not found"` (or legacy 200 with that exact string): show `Jugador no encontrado`, keep the input enabled, and keep the selected player.
  - status 404 with any other `error` string: show `Algo salió mal. Inténtalo de nuevo.`, keep the input enabled; never show "partida no existe".
  - status 500 or a network failure: show `Algo salió mal. Inténtalo de nuevo.`, re-enable the input, keep the selected player, and do **not** auto-resend; do not discard guesses already shown.
  - status 400: show `Solicitud no válida.` and keep the input enabled.
- **RF-10** - **Transition tolerance.** During deployment, the frontend treats the legacy `HTTP 200 + { error }` form as an error (matching RF-9 by the exact `error` string and status intent) and treats only a successful non-error body as a guess result. This tolerance is removed only after the backend is fully rolled out (expand/contract, §Deployment & Compatibility).
- **RF-11** - `PlayerInput` search failure (RESOLVED OD-1). On a network failure or an HTTP 5xx response from `GET /api/players/search`, show a non-blocking message under the input. The message disappears on the next successful search response. An empty result set (`[]`, "no results") is not an error and shows no error message. There is no auto-retry.
- **RF-12** - `POST /api/game/start` failure (RESOLVED OD-3). On a 4xx, 5xx, or network failure when starting a game, show the generic message `Algo salió mal. Inténtalo de nuevo.` and a `Retry` button that calls `POST /api/game/start` again. There is no auto-retry.

## Criterios de aceptación (Acceptance Criteria)

All criteria are Given/When/Then, numbered, and verifiable. Backend criteria are verifiable with automated tests (Jest + supertest against the exported `app`, requiring a seeded database). Frontend criteria are verifiable with an automated component/integration test (or, where tooling is absent, a documented manual procedure noted in the criterion). Deployment criteria are verifiable manually with `curl` against each deployed version.

### Backend (supertest)

- **AC-1 - `GET /api/game/:id`, game not found.** Given no session with id `999999999` exists, When `GET /api/game/999999999` is requested, Then the response is HTTP **404** with body exactly `{ "error": "Game not found" }`.
- **AC-2 - `POST /api/game/:id/guess`, game not found.** Given no session with id `999999999` exists, When `POST /api/game/999999999/guess` is sent with a body `{ "playerId": <valid positive integer> }`, Then the response is HTTP **404** with body exactly `{ "error": "Game not found" }` and no `Guess` row is created for that session id.
- **AC-3 - `POST /api/game/:id/guess`, player not found.** Given a game session exists, When `POST /api/game/:id/guess` is sent with `{ "playerId": 999999999 }` (a non-existent player), Then the response is HTTP **404** with body exactly `{ "error": "Player not found" }`, the session's `attempts` is unchanged, no `Guess` row is inserted, and `isFinished`/`isWin`/`score` are unchanged.
- **AC-4 - `POST /api/game/:id/guess`, null secret (data inconsistency).** Given a game session exists whose `secretPlayerId` does not resolve to a `Player` row, When `POST /api/game/:id/guess` is sent with a valid existing `playerId`, Then the response is HTTP **500** with body exactly `{ "error": "Internal Server Error" }` and the response body does **not** contain the diagnostic detail. (The server writes the diagnostic detail to the log; log capture is an implementation concern verified in the plan.)
- **AC-5 - `POST /api/game/:id/guess`, Zod validation unchanged.** Given any game id, When `POST /api/game/:id/guess` is sent with an invalid body (e.g. `{ "playerId": -1 }`, `{ "playerId": "x" }`, or `{}`), Then the response is HTTP **400** with a body containing `"error": "Validation error"` and a `"details"` field (the current validation shape is preserved).
- **AC-6 - `POST /api/game/:id/guess`, game already finished unchanged.** Given a session whose persisted `isFinished` is `true`, When `POST /api/game/:id/guess` is sent with a valid body, Then the response is HTTP **400** with body exactly `{ "error": "Game already finished" }`.
- **AC-7 - Precedence unchanged.** Given `POST /api/game/:id/guess` requests that trigger different failures, When each is evaluated, Then precedence is: (a) invalid input -> 400 validation (AC-5), (b) unknown game id -> 404 `{ "error": "Game not found" }` (AC-2), (c) known finished game -> 400 `"Game already finished"` (AC-6), (d) unknown `playerId` on a known in-progress game -> 404 `{ "error": "Player not found" }` (AC-3). No case is reachable out of this order.
- **AC-8 - Real error passes through the middleware.** Given the error middleware is registered before `app.listen` and after all routes, When a route/controller/service throws an unmapped `Error`, Then the response is HTTP **500** with a JSON body containing `"error": "Internal Server Error"` (correct status and JSON shape produced by the handler).
- **AC-9 - Players routes preserve their error shape.** Given the players routes are exercised (including induced failures where feasible), When `GET /api/players` or `GET /api/players/random` fails, Then the response remains HTTP **500** with body exactly `{ "error": "Error fetching players" }` or `{ "error": "Error selecting player" }` respectively (the same messages as the base branch). When `GET /api/players/search?q=<value>` fails internally, Then the response is HTTP **500** with body exactly `{ "error": "Internal Server Error" }` (generic middleware message, RESOLVED OD-5). Baseline tests capturing the current responses are in place before the refactor.

### Frontend (component/integration test)

- **AC-10 - 404 game not found on guess.** Given the game page has started a session and the guess endpoint responds with HTTP 404 and body `{ "error": "Game not found" }`, When the user submits a guess, Then the page shows the message `Esta partida ya no existe`, shows a control to start a new game, does not append an error entry to the guesses, and does not render a blank page.
- **AC-11 - 404 player not found on guess.** Given the guess endpoint responds with HTTP 404 and body `{ "error": "Player not found" }`, When the user submits a guess, Then the page shows the brief message `Jugador no encontrado`, the input remains enabled, the selected player is kept, prior guesses remain visible, and no error entry is appended.
- **AC-12 - 404 with an unrecognized error string on guess.** Given the guess endpoint responds with HTTP 404 and a body whose `error` is not exactly `"Game not found"` and not exactly `"Player not found"` (e.g. `{ "error": "Not Found" }`), When the user submits a guess, Then the page shows the generic message `Algo salió mal. Inténtalo de nuevo.`, keeps the input enabled, never shows `Esta partida ya no existe`, and does not append an error entry.
- **AC-13 - 500 or network failure on guess.** Given the guess endpoint responds with HTTP 500 and body `{ "error": "Internal Server Error" }`, or the request fails due to a network error, When the user submits a guess, Then the page shows `Algo salió mal. Inténtalo de nuevo.`, re-enables the input, keeps the selected player, provides a retry affordance consistent with the UI (the user may re-submit manually), does **not** auto-resend the request, and the guesses already shown on screen are not lost. The error body is not appended to guesses.
- **AC-14 - 400 on guess.** Given the guess endpoint responds with HTTP 400 and a validation error body, When the user submits a guess, Then the page shows `Solicitud no válida.`, the input remains enabled, and no error entry is appended.
- **AC-15 - Transition tolerance (legacy 200 + `{ error }`).** Given the frontend is the tolerant version and the backend still returns the legacy form HTTP 200 with body `{ "error": "Player not found" }` or `{ "error": "Game not found" }`, When the user submits a guess, Then the frontend treats the response as an error by exact string comparison (applies AC-10/AC-11 as appropriate), does not append it as a guess, and does not render a blank page.
- **AC-16 - `PlayerInput` search failure.** Given the search request `GET /api/players/search?q=<value>` fails due to a network error or returns HTTP 5xx, When the failure occurs, Then `PlayerInput` shows a non-blocking error message under the input and does not auto-retry. Given a subsequent search request for a value with length >= 2 succeeds and returns `[]` (no results), When the response is received, Then the non-blocking error message is cleared and no error message is shown (empty results are not an error). Given a subsequent search request succeeds with results, Then the error message is cleared and results are shown.
- **AC-17 - `POST /api/game/start` failure.** Given `POST /api/game/start` fails (network error, 4xx, or 5xx), When the failure occurs, Then the page shows the generic message `Algo salió mal. Inténtalo de nuevo.` and a `Retry` button; it does not auto-retry. When the user activates `Retry`, Then the page calls `POST /api/game/start` again.

### Deployment & compatibility (manual, `curl`)

- **AC-18 - Version-matrix verification.** The following combinations are verified against the deployed backend and the built frontend behavior (or equivalent `curl` checks against the API):
  - **(old frontend, old backend):** unchanged baseline behavior.
  - **(tolerant frontend, old backend):** legacy `200 { "error": "Game not found" }` / `{ "error": "Player not found" }` on `POST .../guess` and `GET .../game/:id` are handled as errors by the UI (no blank page, no appended guess).
  - **(tolerant frontend, new backend):** `GET /api/game/999999999` -> 404 `{ "error": "Game not found" }`; `POST /api/game/999999999/guess` with valid body -> 404 `{ "error": "Game not found" }`; `POST .../guess` with unknown `playerId` -> 404 `{ "error": "Player not found" }`; UI shows the correct messages per AC-10/AC-11.
  - **(cleaned frontend, new backend):** same as tolerant+new; legacy-form handling removed.
  - **(cleaned frontend, old backend):** documented as **unsupported** (regression to legacy blank/incorrect handling); phase 3 is performed only after backend stability.

## Casos límite (Edge Cases)

- **Validation precedence (unchanged).** The first applicable check wins: invalid input (400, Zod) -> game not found (404, exact `"Game not found"`) -> game finished (400 `"Game already finished"`) -> player not found (404, exact `"Player not found"`). A malformed body on a non-existent game yields 400 validation, not 404.
- **Null secret vs. missing game.** A missing session is 404 `{ "error": "Game not found" }`. A session that exists but whose secret cannot be resolved is 500 `{ "error": "Internal Server Error" }` (generic). They must not share a status or a misleading message.
- **`GET /api/game/:id` has no Zod body validation.** A non-numeric or unknown `:id` resolves to "not found" (404) via the service; this behavior is otherwise unchanged.
- **Legacy `200 { error }` during transition.** The tolerant frontend must not treat a body containing `error` as a successful guess even when HTTP status is 200, and it must discriminate the exact strings `"Game not found"` / `"Player not found"`.
- **404 with an unrecognized string.** The frontend never renders "partida no existe" for a 404 whose `error` is not exactly `"Game not found"`. It shows the generic error message instead.
- **Network failure on guess (no auto-resend).** `fetch` rejects; there is no JSON body. The UI shows `Algo salió mal. Inténtalo de nuevo.`, re-enables input, keeps the selected player, and preserves prior guesses. It does not auto-resend because the response may have been lost after the server consumed the attempt (see Out of Scope).
- **Game/start failure.** If `POST /api/game/start` fails (4xx/5xx/network), the page has no usable `gameId`; the UI shows `Algo salió mal. Inténtalo de nuevo.` with a `Retry` button that calls start again. No auto-retry. No prior guesses exist to preserve.
- **Player search failure vs. no results.** A network/5xx search failure shows a non-blocking message under the input, cleared on the next successful search. An empty array (`[]`) is "no results", not an error, and must not trigger the error message.
- **Players route `/search` with no query.** Returns HTTP 200 `[]` (unchanged). Internal failure becomes HTTP 500 `{ "error": "Internal Server Error" }` via centralized middleware (AC-9).
- **Double/malformed responses.** Not expected; the tolerant frontend keys on `res.ok` and/or `error` presence and exact-string comparison and is defensive.

## Impacto en el contrato de API (API Contract Impact)

The authoritative, per-endpoint contract is `specs/003-contrato-y-errores/api-contract.md`. This spec does not duplicate it. Summary of breaking/behavioral changes:

- `GET /api/game/:id` not found: 200 `{ error }` -> **404** with body exactly `{ "error": "Game not found" }`.
- `POST /api/game/:id/guess` session not found: 200 -> **404** with body exactly `{ "error": "Game not found" }`.
- `POST /api/game/:id/guess` player not found: 200 -> **404** with body exactly `{ "error": "Player not found" }`.
- `POST /api/game/:id/guess` null secret: 200 `{ error: "Game not found" }` -> **500** with body exactly `{ "error": "Internal Server Error" }`.
- `GET /api/players/search` internal failure: -> **500** with body exactly `{ "error": "Internal Server Error" }` (centralized middleware, generic; RESOLVED OD-5). `GET /api/players` and `/random` keep their existing 500 messages.
- Validation (400 + `details`), `Game already finished` (400), success bodies, and all other endpoints: **unchanged**.
- The exact strings `"Game not found"` and `"Player not found"` on the 404 responses above are part of the contract and are verified by backend tests.

## Frontend Impact

- `frontend/app/game/page.tsx`: add explicit error handling for `POST /api/game/start` and `POST /api/game/:id/guess`; stop blanking the page on `{ error }`; do not append error bodies to `guesses`; implement RF-9/RF-10/RF-12; compare backend `error` strings exactly for discrimination and never render backend error text; on 500/network guess failure re-enable input, keep the selected player, and do not auto-resend; preserve guesses on 500/network.
- `frontend/app/components/PlayerInput.tsx`: implement RF-11 (non-blocking search-failure message under the input, cleared on next successful search; empty results are not an error; no auto-retry). Never render backend error text.
- The frontend has no test suite today; AC-10-AC-17 require adding or documenting a component/integration test approach (tooling choice is in `plan.md`).
- **UI language (verified):** the current interface uses **English** for static labels (`Find the Player`, `New Game`, `Start Game`, `Correct!`, `You Lost!`, `Attempts` in `frontend/app/game/page.tsx`, `frontend/app/page.tsx`). The error messages fixed by this spec are the exact Spanish strings in the table below (as specified by product decision); static labels remain unchanged.

### UI message table (fixed texts)

| Situation | Message shown to user (exact text) | Action available | Notes |
|---|---|---|---|
| `POST /guess` 404, `error` exactly `"Game not found"` (incl. legacy 200 transition) | `Esta partida ya no existe` | Start a new game | Frontend discriminates by exact backend string; never renders backend text. |
| `POST /guess` 404, `error` exactly `"Player not found"` (incl. legacy 200 transition) | `Jugador no encontrado` | Input stays enabled; selected player kept | Brief, non-blocking. |
| `POST /guess` 404, any other `error` string | `Algo salió mal. Inténtalo de nuevo.` | Input stays enabled | Never show "partida no existe". |
| `POST /guess` 500 or network failure | `Algo salió mal. Inténtalo de nuevo.` | Input re-enabled; selected player kept; user may re-submit manually | No auto-resend. Guesses already shown are preserved. |
| `POST /guess` 400 | `Solicitud no válida.` | Input stays enabled | Not expected from the normal UI. |
| `POST /api/game/start` 4xx/5xx or network failure | `Algo salió mal. Inténtalo de nuevo.` | `Retry` button (calls start again) | No auto-retry. |
| `GET /api/players/search` network failure or 5xx | (fixed non-blocking error text, placed under the input; exact copy to be the same generic style as server errors, e.g. `Algo salió mal. Inténtalo de nuevo.`) | None (no auto-retry) | **Copy note:** the user fixed the message behavior but not a distinct Spanish string for this case; the implementation uses the generic error text `Algo salió mal. Inténtalo de nuevo.` under the input unless clarified. Clears on next successful search. |
| `GET /api/players/search` returns `[]` (no results) | (no error message) | — | "No results" is not an error. |

## Existing Tests Impact

| File | Test / area | Current behavior (base `main`) | Required change |
|---|---|---|---|
| `backend/src/test/game-state-integrity.test.ts` | `T-09 - nonexistent playerId does not consume an attempt` (base asserts `res.status === 200`; does not assert the error body) | Returns 200 `{ error: "Player not found" }`; T-09 verifies no state mutation only. | Expect HTTP **404** and body exactly `{ "error": "Player not found" }`; keep all assertions that `attempts`/`Guess` rows/`isFinished`/`isWin`/`score` are unchanged. (The working branch already reflects this change; the spec records the delta vs. base.) |
| `backend/src/test/game-state-integrity.test.ts`, `game.service.test.ts`, `game.test.ts` | All others | No assertions on `GET /api/game/:id` not-found, POST-guess game-not-found, null secret, Zod `details`, exact 404 strings, or `/search` 500 body. | No change required by existing assertions; add new tests for AC-1-AC-9 (including exact-string and `/search` generic 500 assertions). |
| `backend/test/app.e2e-spec.ts` | Nest scaffold e2e | Not part of the Express API contract. | Out of scope / unchanged. |
| Players routes | - | No route-level tests exist. | Add baseline tests before refactor to satisfy RF-7/AC-9 (capture `/`, `/random` fixed messages and `/search` current failure shape, then preserve/align to RF-7). |

## Deployment & Compatibility

The backend and frontend deploy separately. Use the **expand / contract** strategy (resolved):

1. **Phase 1 - Expand (deploy tolerant frontend first).** The frontend accepts both legacy `200 { error }` and new `4xx/5xx { error }`. It detects failure by `res.ok === false` or an `error` field, discriminates by exact string where specified, and never appends an error body as a guess. Verify with the old backend still deployed (AC-18, tolerant+old).
2. **Phase 2 - Deploy backend.** Enable 404/500 semantics with the exact contract strings, null-secret 500, `GET /:id` service-throws + middleware 404, `/search` generic 500, and the corrected middleware order. Verify tolerant frontend + new backend (AC-18).
3. **Phase 3 - Contract (frontend cleanup).** After backend stability/rollback window, remove legacy `200 { error }` handling from the frontend. Verify cleaned + new (AC-18). **Cleaned frontend + old backend is unsupported.**

Manual `curl` examples (against the target environment base URL):
- `curl -i <BASE>/api/game/999999999` -> expect `404` and `{"error":"Game not found"}` (phase 2+).
- `curl -i -X POST <BASE>/api/game/999999999/guess -H "Content-Type: application/json" -d '{"playerId":1}'` -> `404` `{"error":"Game not found"}` (phase 2+).
- `curl -i -X POST <BASE>/api/game/<validId>/guess -H "Content-Type: application/json" -d '{"playerId":999999999}'` -> `404` `{"error":"Player not found"}` (phase 2+).
- `curl -i -X POST <BASE>/api/game/<validId>/guess -H "Content-Type: application/json" -d '{"playerId":-1}'` -> `400` with `Validation error` and `details` (all phases, unchanged).

## Fuera de alcance (Out of Scope)

- Game rules, scoring, max attempts, hint values, and `comparePlayers` logic (spec 002).
- NestJS scaffold cleanup, seed typos, and README fixes (spec 004).
- Authentication, rate-limit policy changes, session expiration, daily/leaderboard behavior, and the `GET /api/game/:id` response shape on success.
- Adding comments to code, schema/migration changes (none required), and changing the secret-reveal semantics of spec 002.
- Visual design of the frontend error UI beyond the fixed messages/actions; component structure and styling choices belong in `plan.md`.
- **Lost-response ambiguity (RESOLVED OD-2, out of scope):** if a `POST /guess` response is lost (network failure/timeout) after the server accepted the request, the client cannot know whether the attempt was consumed. The frontend does not auto-resend. Resolving this requires idempotency keys or a state-reload mechanism and is a candidate for a future spec.
- **Additive `code` field (RESOLVED OD-4, out of scope):** adding a machine-readable additive field such as `code` (e.g. `GAME_NOT_FOUND`, `PLAYER_NOT_FOUND`) alongside `error` is a candidate for a future spec; this spec fixes and relies on the exact `error` strings.

## Decisiones abiertas (Open Decisions)

None. All open decisions from the previous revision (OD-1 through OD-5) are resolved and recorded below.

### Decisiones resueltas (para trazabilidad)

1. Error shape `{ error: string }`; validation keeps `details` (exists today).
2. 400 = malformed; 404 = well-formed reference to a nonexistent entity.
3. `"Player not found"` -> 404; `"Game not found"` -> 404 (`GET /:id`, `POST /guess`).
4. Null secret -> 500 generic; detail only in log.
5. `GET /api/game/:id`: service throws, middleware responds 404.
6. Players routes -> `asyncHandler` + middleware, with baseline tests to preserve current error shape.
7. Middleware order fixed, with a test proving a real error yields JSON `{ error }` + correct status.
8. Deploy expand/contract: tolerant frontend -> backend -> frontend cleanup.
9. Handler style unified on `asyncHandler`.
10. Frontend UX fixed (see §Frontend Impact table): 404 game -> `Esta partida ya no existe` + new game; 404 player -> `Jugador no encontrado`, input enabled, selected player kept; 404 other -> generic, never "partida no existe"; 500/network guess -> `Algo salió mal. Inténtalo de nuevo.`, input re-enabled, selected player kept, no auto-resend, guesses preserved; 400 -> `Solicitud no válida.`; start failure -> generic + `Retry` (calls start), no auto-retry.
11. **OD-1 (RESOLVED):** `PlayerInput` search network/5xx shows a non-blocking message under the input, cleared on the next successful search. Empty results `[]` are not an error. No auto-retry.
12. **OD-2 (RESOLVED):** 500/network on `POST /guess` shows the error, re-enables input, keeps the selected player; never auto-resends. Lost-response/consumed-attempt ambiguity is out of scope (future idempotency/state reload).
13. **OD-3 (RESOLVED):** `POST /api/game/start` failure shows the same generic server error and a `Retry` button that calls start again. No auto-retry.
14. **OD-4 (RESOLVED):** Exact strings `"Game not found"` and `"Player not found"` on `POST /guess` 404 are part of the contract, verified by backend tests; frontend compares exactly. Any other 404 string yields the generic message, never "partida no existe". Additive `code` field is out of scope (future).
15. **OD-5 (RESOLVED):** `/api/players/search` internal failure responds with the generic middleware message (`"Internal Server Error"`). General rule: the frontend never shows backend error text to users; it uses its own messages by context/status.

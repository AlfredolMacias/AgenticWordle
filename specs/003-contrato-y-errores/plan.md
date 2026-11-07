# Plan - 003 API Contract & Error Handling

Implementation plan derived from `specs/003-contrato-y-errores/spec.md` and `specs/003-contrato-y-errores/api-contract.md`. Every item below traces to a requirement (RF-x) or acceptance criterion (AC-x) of the spec. "Discarded alternatives" records options considered and rejected.

This spec spans **two repositories/packages deployed separately** (`backend/`, `frontend/`). The plan is anchored to the **base branch (`main`, deployed behavior)** verified with `git show main:<path>`. The working branch is **restarted from base** for this work; the plan does not depend on any partial changes present in the working tree.

## 1. Approach summary

Normalize error signaling at the source (service throws / middleware maps) and make the frontend defensive and message-driven. Delivery is **expand/contract** across two deployable units: (A) ship a tolerant frontend that accepts both legacy `200 { error }` and new `4xx/5xx` forms, (B) ship backend status/contract changes and players-route refactor behind preserved shapes, then (C) remove legacy-form handling from the frontend immediately after B is verified. Players routes get characterization tests *before* the `asyncHandler` refactor (RF-7/AC-9). The null-secret case is covered by a unit/mock test because the Prisma schema prevents provoking it via an integration row (RF-4/AC-4).

## 2. Delivery strategy

Three independent, ordered deliveries, all **inside spec 003**. **C is executed right after B is verified; the spec closes when C is done.**

### Deploy control and rollback

- **Merge/order control (A → verify → B → verify → C):** merge and deploy A, run the A verification (matrix case 2 + quick prod smoke), then merge and deploy B, run B verification (case 3), then merge and deploy C, run C verification (case 4). **Never deploy B before A is live; never deploy C before B is verified.**
- **Rollback:** reverting B leaves the **tolerant frontend (A)** working against the old backend contract (case 2 holds) because A accepts both `200 { error }` and `4xx/5xx`. Reverting C restores tolerance.
- **Deployment mechanics (repo-verified vs unverified):** no `.github/workflows`, no `vercel.json`, and no backend hosting config (`railway.json`/`render.yaml`/`fly.toml`/`Dockerfile`) exist in the repo — CI, deploy branches, preview/staging environments, and hosting platform are **unverified**. Verifiable from repo: backend build/start (`backend/package.json`: `npm run build` = `prisma generate && tsc -p tsconfig.build.json`; `npm start` = `prisma migrate deploy && prisma db seed && node dist/src/server.js`), CORS allows `https://findfootballplayer.vercel.app` (`backend/src/server.ts:11`, Vercel origin suggested, hosting **unverified**), env vars `DATABASE_URL`/`PORT` (backend) and `NEXT_PUBLIC_API_URL` (frontend). **Where `NEXT_PUBLIC_API_URL` is configured per environment is unverified** (no env config files in repo; concrete values not provided). Any deploy detail not visible in the repo remains **unverified**.

### Local pre-merge verification (`git worktree`)

Before merging each delivery, verify the 4-combination matrix locally:

- Use `git worktree` to run the **base backend** and the **new backend** side by side on **different ports**, using the **same development database** (subject to the spec-002 host/`DATABASE_URL` guards and test-data cleanup). Point frontends at each backend via `NEXT_PUBLIC_API_URL`.
- **Next.js note:** `NEXT_PUBLIC_*` variables are **inlined at build time**. In `next dev`, restart the dev server when changing `NEXT_PUBLIC_API_URL`; for a production-like check use separate builds/starts per target (or distinct env files) as appropriate.
- Complement with `curl` spot checks for exact status/body.

### Compatibility matrix (AC-18)

| # | Frontend | Backend | Expected result | Notes |
|---|---|---|---|---|
| 1 | Base (old) | Base (old) | Unchanged baseline behavior. | Reference. |
| 2 | **Tolerant / new (A)** | Base (old) | Legacy `200 { "error": "Game not found" }` / `{ "error": "Player not found" }` handled as errors by exact string; **no blank page, no appended guess**; start/search/guess show spec messages/actions (AC-10/AC-11/AC-14–AC-17 as applicable). | Validates A against old backend. |
| 3 | **Tolerant / new (A or C-state without C deployed?)** / **New** | **New (B)** | `GET /api/game/999999999` → 404 `{"error":"Game not found"}`; `POST .../guess` unknown game → 404; unknown `playerId` → 404; null-secret path → 500 generic (not user-exposed as not-found); UI per AC-10–AC-14, AC-16–AC-17. | Target steady state pre/post C. |
| 4 | Base (old) | **New (B)** | **Inverted order / regression:** base frontend lacks `res.ok`/error-body guarding and blanks on `{ error }` (`frontend/app/game/page.tsx` base `:33-37`), so the new 404/500 `{ error }` responses trigger the legacy blank/incorrect behavior. | Documents why **B must not deploy before A**. |

After each delivery, run a **quick production smoke** (or equivalent environment) on the affected flows: A → start/search/guess error rendering; B → `curl` 404/400/500 contracts + UI via tolerant frontend; C → no regression of case 3.

Manual `curl` (AC-18, phase 2+): `GET <BASE>/api/game/999999999` → 404 `{"error":"Game not found"}`; `POST <BASE>/api/game/999999999/guess` `{"playerId":1}` → 404 `{"error":"Game not found"}`; `POST <BASE>/api/game/<validId>/guess` `{"playerId":999999999}` → 404 `{"error":"Player not found"}`; invalid body `{"playerId":-1}` → 400 with `Validation error` and `details` (all phases).

### Delivery table

| Delivery | Repo / branch | What it includes | How verified | Must work with |
|---|---|---|---|---|
| **A — Tolerant frontend** | `frontend/` (deploy independently) | RF-8–RF-12, RF-10 transition tolerance; exact-string discrimination for `"Game not found"` / `"Player not found"`; UI message table from the spec; no append of error bodies; search/start/guess error handling; no auto-resend/retry. No backend contract change required. Includes **T-A0** (test config, see §8). | Automated: Vitest + React Testing Library (mocked `fetch`), minimal (AC-10–AC-17). Build: `npm run build`, `npm run lint` in `frontend/`. AC-18: manual local `git worktree` + quick prod smoke. | **Old backend** (legacy `200 { error }`) and later **new backend**. |
| **B — Backend contract** | `backend/` (deploy independently, **after A is live**) | RF-1–RF-7, AC-1–AC-9, T-09 delta: 404s for game/player not found, 500 generic for null secret (+ log detail), `GET /:id` service throws→middleware 404, Zod/finished unchanged, middleware registered before `app.listen` and after routes + real-error test, players routes migrated to `asyncHandler`+middleware with preserved shapes (`/search` internal failure → generic 500). | `npx jest --forceExit` (and e2e config as applicable), `npm run build`, `npm run lint`, `npm run format` in `backend/`; reuses spec-002 safeguards (Jest host guard, test-data cleanup). `curl` + local matrix case 3 + quick prod smoke. | **Tolerant frontend (A)**. |
| **C — Frontend cleanup** | `frontend/` (deploy independently, **right after B is verified**) | Remove legacy `HTTP 200 + { error }` handling/tolerance paths introduced in A (RF-10 removal). Keep exact-string discrimination and all UX/messages/actions. | Same frontend verification as A + AC-18 (case 3 maintained / cleanup verified) + quick prod smoke. B must be verified before C. **Spec 003 closes when C is done.** | **New backend (B) only**. |

## 3. Frontend changes (delivery A)

Traces to RF-8–RF-12, AC-10–AC-17.

**`frontend/app/game/page.tsx`** (base `:1-81`): `start` effect (`:12-18`, no error handling, sets `gameId` from `data.id`), `handleGuess` (`:20-37`, appends body unconditionally, blank page on any `g.error` at `:34-37`), derived UI state/messages (`:38-79`).
- Add explicit error handling for `POST /api/game/start` and `POST /api/game/{id}/guess` (RF-8, RF-9, RF-12): check `res.ok` and/or parse body; wrap in `try/catch` to catch network failures (no JSON body). **Never** append an error body to `guesses`; **never** render a blank page on `{ error }`.
- Discriminate guess errors by **exact** backend `error` string where specified (RF-9, AC-10–AC-12, AC-15): `error === "Game not found"` → message `Esta partida ya no existe` + action to start a new game; `error === "Player not found"` → `Jugador no encontrado`, input enabled, selected player kept; 404 with any other string → `Algo salió mal. Inténtalo de nuevo.`, never "partida no existe". 500/network → `Algo salió mal. Inténtalo de nuevo.`, re-enable input, keep selected player, **no auto-resend**, preserve guesses already shown. 400 → `Solicitud no válida.`.
- Start failure (4xx/5xx/network, RF-12, AC-17): show `Algo salió mal. Inténtalo de nuevo.` and a `Retry` control that calls start again; **no auto-retry**.
- **Transition tolerance (RF-10):** treat legacy `HTTP 200 + { error }` as an error using the same exact-string/intent rules; only a successful non-error body is a guess. Preserve the selected player for guess errors that keep input enabled (requires component state/prop coordination with `PlayerInput`; implementation detail in tasks).
- UI texts/actions must match the spec UI message table; labels `Find the Player`, `New Game`, `Start Game`, `Correct!`, `You Lost!`, `Attempts` remain unchanged. Frontend must **never render backend error text** (RF-9, resolved rule).
- **UI language (verified):** current interface static labels are **English** (`frontend/app/game/page.tsx:40,58-66,69,77-78`, `frontend/app/page.tsx:11-47`). Error messages fixed/confirmed for this spec are **Spanish** (including search failure `Algo salió mal. Inténtalo de nuevo.`). **Note (no change here):** the spec UI table still contains a "Copy note" caveat for the search-failure row; the user has confirmed the copy in the plan, but this plan does not modify the spec/contract — flag for spec cleanup if desired.

**`frontend/app/components/PlayerInput.tsx`** (base `:1-104`): live search path is `debouncedSearch` + `handleChange` (`:14-35`, `fetch` at `:26`). `handleSearch` is defined at `:68-81` (also `fetch` at `:77`) and is **not referenced** elsewhere in `frontend/` (verified by grep). **OD-1 applies only to the live search path.** `handleSearch` is dead code → **suggestion out of scope** (spec 004 / cleanup); do not expand scope.
- RF-11, AC-16 (live path): on network failure or 5xx from `GET /api/players/search`, show a non-blocking message **under the input** with the **confirmed** text `Algo salió mal. Inténtalo de nuevo.`; clear it on the next **successful** search response. `[]` (no results) is **not** an error and must not show the error. No auto-retry.

**Message location:** define the fixed UI strings in a small frontend-local constant/module or colocated constants consistent with the app style, so game page and `PlayerInput` share the same copy (structure is an implementation choice; strings are fixed/confirmed per the spec). No backend error text displayed.

## 4. Backend changes (delivery B)

Traces to RF-1–RF-7, AC-1–AC-9.

**`backend/src/services/game.service.ts`** (base: `getGameService` `:54-65`, `makeGuessService` `:101-256`).
- RF-1, RF-2, AC-1, AC-2: `getGameService` / session-not-found in `makeGuessService` **throw** `new Error("Game not found")` instead of returning `{ error }` (base returns at `:60-62`, `:106-108`). Middleware maps to 404. Preserve game/atomic logic from spec 002.
- RF-3, AC-3: unknown `playerId` throws `new Error("Player not found")` (base returns at `:131-133`) → 404. Must not consume an attempt / create a `Guess` / mutate session state.
- RF-4, AC-4: when the session's secret player cannot be resolved (base returns `{ error: "Game not found" }` at `:151-153`), log a **diagnostic detail server-side** and throw an error that the middleware maps to **HTTP 500** with body exactly `{ "error": "Internal Server Error" }` (generic; no detail in body). Do **not** classify as "Game not found"/404.
- RF-5, AC-5–AC-7: precedence unchanged (Zod in controller → game not found → finished → player not found); null secret remains a defensive guard after lookups yielding 500. `"Game already finished"` remains 400.

**`backend/src/controllers/game.controller.ts`** (base `:11-39`, no `next`/try-catch).
- Controllers participate in the `asyncHandler` chain (`routes/game.ts` base `:13-21` wraps all). Propagate rejections so `asyncHandler` forwards to middleware (unified style, RF-7) without changing validation/response shapes. Zod `.parse` remains (RF-5).

**`backend/src/middleware/error.middleware.ts`** (base `:1-33`).
- Preserve mappings: `ZodError` → 400 `{ error: "Validation error", details: err.message }` (`:11-16`, AC-5); `"Game already finished"` → 400 (`:21-23`, AC-6). Add/ensure `"Player not found"` → 404 `{ error: "Player not found" }` (RF-3). `"Game not found"` → 404 `{ error: "Game not found" }` (RF-1/2). Ensure null-secret path results in **500 generic** (not 404). Unknown errors → 500 `{ error: "Internal Server Error" }`, log detail (AC-8, RF-4).

**`backend/src/server.ts`** (base: routes `:28-29`, `app.listen` `:33-35`, `errorHandler` `:37`).
- RF-6, AC-8: register `app.use(errorHandler)` **before** `app.listen(...)` and **after** all routes. Keep the exported `app` usable by supertest.

**`backend/src/routes/players.ts`** (base `:1-52`).
- RF-7, AC-9: migrate to `asyncHandler` + centralized error middleware. **Before or as part of the refactor, add baseline characterization tests** that capture current external behavior and must pass on base-aligned code, then continue to pass after refactor.
- **Current messages / post-refactor preservation (verified, base):**
  - `GET /` failure (`:7-13`) → **500** `{ "error": "Error fetching players" }` (exact). **Preserve** this exact message after refactor.
  - `GET /random` failure (`:16-23`) → **500** `{ "error": "Error selecting player" }` (exact). **Preserve** this exact message after refactor.
  - `GET /search` (`:25-52`, no try/catch): `q` empty → 200 `[]` (unchanged). Internal Prisma rejection on base: **Express 5.2.1** (`backend/package.json` `"express": "^5.2.1"`) auto-forwards async rejections to error middleware, so the request reaches `errorHandler` and returns **500** `{ "error": "Internal Server Error" }` (generic) — the request does **not** hang. Post-refactor under `asyncHandler` + centralized middleware the **same** generic 500 applies (RF-7/OD-5). **Conserve** 500 + `{ error }` shape; message is the generic middleware message.
- **Risk / detection:** a naive `asyncHandler` refactor that lets `/` and `/random` errors fall through to the generic handler would change their messages to `"Internal Server Error"`. The characterization tests (AC-9) **detect** this; the refactor must explicitly preserve the `/` and `/random` messages.
- Do not change the success contracts.

**`backend/src/routes/game.ts`** (base `:1-21`): already uses `asyncHandler`; keep unified (RF-7).

## 5. Cleanup (delivery C)

Traces to RF-10, AC-15 (phase 3), AC-18.

- **What to remove (`frontend/app/game/page.tsx`, and any shared helper introduced in A):** the legacy-tolerance branch that treats `HTTP 200 + { error }` as an error-path surrogate for the old backend (RF-10 transition-only). Retain detection by `res.ok`/error body for real 4xx/5xx, exact-string discrimination for `"Game not found"`/`"Player not found"`, all UI messages/actions, and "never append error body" rules.
- **Condition:** backend delivery B deployed and verified (AC-18 case 3 green). C executes right after B is verified. AC-18 matrix case 4 documents the unsupported inverted-order regression (not a C target).
- **Disposition:** **inside spec 003** (delivery C). The spec closes when C is done.

## 6. API contract changes

Authoritative per-endpoint contract: `specs/003-contrato-y-errores/api-contract.md` (do not duplicate). This plan implements its breaking/status changes: `GET /api/game/:id` not-found → 404 `{"error":"Game not found"}`; `POST /guess` session-not-found → 404 `Game not found`; player-not-found → 404 `Player not found` (exact strings, part of contract); null secret → 500 `{"error":"Internal Server Error"}`; `/api/players/search` internal failure → 500 generic; validation/finished/success/other endpoints unchanged except handler-style internals with preserved shapes.

## 7. Existing tests impact

| Existing test / area (repo: backend unless noted) | Current behavior asserted (base `main`) | Change needed | Delivery |
|---|---|---|---|
| `backend/src/test/game-state-integrity.test.ts` — `T-09 — nonexistent playerId does not consume an attempt` (base ~266-298) | `res.status === 200`; verifies no mutation of `attempts`/`Guess`/`isFinished`/`isWin`/`score`; no error-body assertion. | Expect HTTP **404** and body exactly `{ "error": "Player not found" }`; **keep** all no-mutation assertions. | B |
| `backend/src/test/game-state-integrity.test.ts`, `game.service.test.ts`, `game.test.ts` — other cases | No assertions on GET not-found, POST game-not-found, null secret, Zod `details`, exact 404 strings, `/search` 500 body. | No change to existing assertions; **add** tests for AC-1–AC-9. | B |
| `backend/src/test/game.test.ts` — `/api/players/search` success | Asserts success shape for `q=ma`. | Keep; add baseline/failure-shape coverage per RF-7/AC-9 as needed (new file or added cases). | B |
| `backend/test/app.e2e-spec.ts` (Nest scaffold) | Not Express contract. | **Unchanged / out of scope.** | — |
| Players routes — (none exist) | No characterization tests. | **Add baseline characterization tests before refactor** (RF-7/AC-9). | B |
| Frontend — (none exist) | No project test infra (`frontend/package.json` has no test script/deps; no `*.test/spec` or jest/vitest config outside `node_modules`). | AC-10–AC-17: **Vitest + React Testing Library, minimal, mocked `fetch`** (no Playwright). **T-A0** adds config + **1 smoke test**. AC-18 is manual. | A (+ T-A0), C |

## 8. Testing strategy

Traces to AC-1–AC-18, RF-1–RF-12. Reuses spec-002 safeguards (Jest host/`DATABASE_URL` guard, test-data cleanup) without redefining them.

### Backend (Jest + supertest, exported `app`, seeded DB)

| AC / RF | Test (type, file, repo) | Notes |
|---|---|---|
| AC-1 (RF-1) | Integration, `backend/src/test/` (e.g. `api-contract-errors.test.ts` or `game-state-integrity.test.ts`), backend | `GET /api/game/999999999` → 404 body exactly `{"error":"Game not found"}`. |
| AC-2 (RF-2) | Integration, backend | `POST /api/game/999999999/guess` valid body → 404 exact; assert no `Guess` created for that session id. |
| AC-3 (RF-3) | Integration, backend (update T-09) | Unknown `playerId` (e.g. `999999999`) → 404 exact; keep no-mutation assertions. |
| AC-4 (RF-4) | **Unit (mock)**, backend (e.g. `backend/src/test/game.service.test.ts` or new unit file) | Prisma schema makes integration impossible (`GameSession.secretPlayerId` is non-nullable `Int` with FK, `schema.prisma:33-41`; cannot insert null/missing secret and cannot delete referenced `Player`). **Mock Prisma** to simulate a session whose resolved secret is `null`; **spy on the logger the repo uses**; assert the response path yields HTTP 500 with body exactly `{ "error": "Internal Server Error" }`, the diagnostic detail is logged, and the body exposes no detail. **Implementation note:** identify the real logger export by grepping `console.`/`logger` in `backend/src` at implementation time (currently `backend/src/lib/logger.ts` exports pino `logger`; `backend/src/middleware/error.middleware.ts` imports it and also calls `console.log`). |
| AC-5 (RF-5) | Integration, backend | Invalid bodies (`playerId` -1, `"x"`, `{}`) → 400 with `error:"Validation error"` and `details`. |
| AC-6 (RF-5) | Integration, backend | Reuse/confirm finished-session → 400 exact `Game already finished`. |
| AC-7 (RF-5) | Integration, backend | Precedence: invalid→400; unknown game→404 game; known finished→400 finished; unknown player on in-progress known game→404 player. Structure tests so order is explicit. |
| AC-8 (RF-6) | Integration, backend | Make a **Prisma method fail with a spy** and call a **real route** (no test routes added to the app); assert the registered error handler returns HTTP 500 with JSON `{"error":"Internal Server Error"}` and the correct status. Also confirms middleware is registered before `app.listen` and after routes. |
| AC-9 (RF-7) | **Characterization first, then regression**, backend | **Before refactor:** capture current base-aligned responses. `GET /api/players` induced failure → 500 `{"error":"Error fetching players"}` (exact, preserved). `GET /random` → 500 `{"error":"Error selecting player"}` (exact, preserved). `GET /search?q=...` internal failure → 500 `{"error":"Internal Server Error"}` (generic; Express 5 auto-forwards async rejection to error middleware, request does **not** hang); `q` empty → 200 `[]`. Tests must pass pre-refactor and post-refactor; a naive refactor that genericizes `/` or `/random` messages **must fail** these tests. Induce failures via Prisma spy/mock. |

### Frontend (Vitest + React Testing Library, minimal, mocked `fetch`)

| AC / RF | Test / task (repo: frontend) | Notes |
|---|---|---|
| **T-A0** (RF-8/infra) | Config task + **1 smoke test**, `frontend/` | Set up Vitest + React Testing Library with `fetch` mocked (no Playwright). Single smoke test proves the harness works. |
| AC-10–AC-15 (RF-8–RF-10) | Component/integration tests, `frontend/` | Verify exact UI messages/actions from spec table, exact-string discrimination, no blank page, no appended error, no auto-resend, selected player/guesses preserved as specified, legacy 200 tolerance. Search-failure copy is **confirmed** as `Algo salió mal. Inténtalo de nuevo.`. |
| AC-16 (RF-11) | Component/integration test, `frontend/` (`PlayerInput`, live path) | Network/5xx on the **live** search path → non-blocking `Algo salió mal. Inténtalo de nuevo.` under input, cleared on next successful search; `[]` not an error; no auto-retry. |
| AC-17 (RF-12) | Component/integration test, `frontend/` | Start failure → generic + `Retry` calls start again; no auto-retry. |

### Deployment / compatibility (manual)

| AC | Verification | Delivery |
|---|---|---|
| AC-18 (all RFs) | **Manual**: local pre-merge `git worktree` matrix (base/new backend on different ports, same dev DB with spec-002 safeguards, frontends pointing via `NEXT_PUBLIC_API_URL`; restart `next dev` on env change or use separate builds) + `curl`; then **quick production smoke after each delivery**. Cases 1–3 expected pass; case 4 documents inverted-order regression (B before A). Real staging/prod env mechanics and per-env `NEXT_PUBLIC_API_URL` config remain **unverified**. | A (case 2), B (case 3), C (case 3 maintained). |

## 9. Risks and recommended execution order

**Risks**
- **Deploy order inversion (critical):** shipping B before A breaks the old frontend (blank page / no `res.ok` handling) for not-found/player-not-found cases (matrix case 4). Shipping C before B is verified is unsupported and regresses on rollback. **Control via merge order A → verify → B → verify → C.** Reverting B leaves tolerant A functional.
- **Players refactor shape drift:** `/` and `/random` must keep exact 500 messages (`"Error fetching players"`, `"Error selecting player"`). `/search` becomes/remains generic 500 (`"Internal Server Error"`) — correct for Express 5 async forwarding and RF-7/OD-5. A naive centralization would genericize `/` and `/random`; characterization tests (AC-9) detect this.
- **Express 5 async behavior (verified):** `express@^5.2.1` auto-forwards rejected promises from async handlers to error middleware, so base `/search` failures do **not** hang and reach `errorHandler` (500 generic). Characterization tests must reflect this real behavior.
- **Null-secret not integration-testable:** Prisma FK/non-nullable `secretPlayerId` prevents creating the row state; rely on unit/mock (AC-4) with Prisma mocked and a logger spy (identify real logger export at implementation: grep `console.`/`logger` in `backend/src`) — do not weaken the schema or add test-only DB hacks.
- **Exact-string contract:** frontend and backend tests depend on `"Game not found"` / `"Player not found"` being exact; any message drift breaks discrimination (RF-9/OD-4).
- **Shared dev DB (backend tests / local matrix):** reuse spec-002 host guard and cleanup; avoid corrupting a deployed DB.
- **`NEXT_PUBLIC_API_URL` inlining (Next.js):** baked at build; `next dev` requires restart on change — account for this in local `git worktree` matrix runs.
- **Deployment config unverified:** CI, hosting, branches, preview/staging, and per-env `NEXT_PUBLIC_API_URL` configuration are not present in repo (**unverified**). Use local `git worktree` + `curl` + quick prod smoke; coordinate real rollout per merge-order control above.

**Recommended execution order**
1. **(B-prep)** Add backend characterization tests for players routes (RF-7/AC-9) on base-aligned behavior; ensure green (Express 5 async → `/search` 500 generic; `/` and `/random` exact messages).
2. **(B)** Implement RF-1–RF-6: service throws, controller propagation, middleware mappings/order + AC-8 (Prisma-spy + real route), null-secret 500+log (AC-4 unit/mock + logger spy; identify logger export via grep at impl); update T-09 and add AC-1–AC-7 tests. Run `npx jest --forceExit`, build/lint/format.
3. **(B)** Refactor `players.ts` to `asyncHandler`+middleware preserving `/` and `/random` messages and `/search` generic 500 (RF-7); characterization tests stay green.
4. **(T-A0, A)** Set up Vitest + React Testing Library (mocked `fetch`) + 1 smoke test. Implement tolerant frontend (RF-8–RF-12, RF-10) in `game/page.tsx` + `PlayerInput.tsx` (live path only; `handleSearch` dead → suggestion out of scope) with confirmed search-failure copy; run Vitest/build/lint; merge+deploy A. Local matrix case 2 + quick prod smoke.
5. **(B deploy)** Merge+deploy backend B; local matrix case 3 + `curl` + quick prod smoke. (Rollback of B → A remains tolerant.)
6. **(C)** Right after B is verified, merge+deploy C to remove RF-10 legacy tolerance; quick prod smoke (case 3 maintained). **Spec 003 closes when C is done.**

## 10. Discarded alternatives

- **Backend-first deploy / atomic big-bang:** rejected — base frontend renders blank on `{ error }` and lacks `res.ok` handling (matrix case 4); merge-order control prevents it.
- **Keep legacy `200 { error }` contract:** rejected — contradicts RF-1–RF-3 and truthful HTTP semantics.
- **Return 404 for null secret:** rejected (resolved) — data inconsistency, not missing entity; must be 500 generic with log-only detail.
- **Frontend renders backend `error` strings:** rejected (resolved) — frontend uses own messages; backend strings only for exact discrimination.
- **Auto-resend on guess network failure / auto-retry on start/search:** rejected (resolved) — risks duplicate/unknown consumed attempts; lost-response ambiguity is out of scope.
- **Integration test for null secret by mutating DB around FK:** rejected — schema prevents it; use unit/mock with logger spy.
- **Players refactor without characterization tests:** rejected — high risk of silent message/shape changes (RF-7), especially `/` and `/random` exact messages.
- **Playwright / heavy e2e for this spec:** rejected — Vitest + RTL (minimal, mocked fetch) chosen; AC-18 remains manual.
- **Test routes added to the app (AC-8):** rejected — fail Prisma via spy and call a real route.
- **Additive `code` field / idempotency keys now:** out of scope (resolved notes); candidates for future specs.
- **Refactor/reuse of dead `handleSearch` (`PlayerInput.tsx:68-81`):** suggestion out of scope (spec 004); OD-1 applies to the live search path only.

## 11. Doubts

No open doubts.

## Reported discrepancies (not applied; no contradiction to spec)

- **Search-failure copy in spec:** spec UI table row for search failure still includes a "Copy note" caveat, but the user confirmed the text as `Algo salió mal. Inténtalo de nuevo.` (reflected in this plan). The plan does **not** modify `spec.md`/contract; consider a minor spec-text cleanup separately.
- **Express 5.2.1 + `/search` base behavior:** async rejection is auto-forwarded to `errorHandler` → 500 `{ "error": "Internal Server Error" }` (not hung). Matches RF-7/OD-5 and the characterization target.
- **`/` and `/random` messages:** today exact (`Error fetching players` / `Error selecting player`); preserved by spec/RF-7 and enforced by characterization tests.
- **Logger (AC-4):** real exports/usage exist (`backend/src/lib/logger.ts` exports pino `logger`; middleware also uses `console.log`) — identify the exact spy target at implementation via grep of `console.`/`logger` in `backend/src`.
- **Working branch partial changes:** out of scope; work restarts from base. No code/spec/contract modified by this plan.

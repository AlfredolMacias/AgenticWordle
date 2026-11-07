# Tasks - 003 API Contract & Error Handling

Derived from `spec.md`, `plan.md`, and `api-contract.md` in this folder. Small, independently verifiable tasks (ideally one task = one commit). Tests precede implementation; tests that start red must fail for the right reason.

**Source of truth for current/base behavior is the `main` (BASE) branch, not the working branch.** All tasks start from BASE. Any behavior described as "current" refers to BASE unless stated otherwise.

**Scope spans two deployable units** (`backend/`, `frontend/`) with three ordered deliveries (expand/contract): **A) tolerant frontend -> B) backend new status/contract -> C) frontend cleanup** (plan §2). Order is strict; merges are separated by verification. **If inverted (plan compatibility matrix):** deploying B before A breaks the base frontend (base `frontend/app/game/page.tsx:33-37` blanks on `{ error }` and lacks `res.ok` handling) — matrix case 4 (base/new) is a regression; **never deploy B before A is live**. Deploying C before B is verified is unsupported (cleaned frontend + old backend regresses). Reverting B leaves tolerant A working against the old backend only while C is not deployed; **from delivery C onward, reverting B requires reverting C first** (C removes frontend tolerance, RF-10/AC-15).

Each task: **ID · objective · covers (RF/AC/plan) · repo · files · verification · expected test state on BASE** (red/green/n/a when applicable).

AC/RF coverage is summarized at the end; anything missing is listed in **Gaps**. No work outside `spec.md`/`plan.md` is added.

## Order summary

T-00 -> T-00b -> CP-1 -> A-01 -> CP-2 -> A-02..A-06 -> CP-3 -> A-07..A-09 -> A-10 -> CP-4 -> A-V1 (manual, base/base + A/base only) -> CP-5 -> A-D1 (manual, merge/deploy A) -> CP-6 -> B-01 -> CP-7 -> B-02, B-03a, B-03b, B-04, B-05, B-06 -> CP-8 -> B-07..B-09 -> B-10 -> CP-9 -> B-V1 (manual, full 4-combination matrix, before B merge) -> CP-10 -> B-D1 (manual, merge/deploy B) -> CP-11 -> C-01 -> C-02 -> CP-12 -> C-D1 (manual, merge/deploy C) -> CP-13 -> D-01..D-03 -> CP-14.

**Strict:** merge/deploy A, verify -> merge/deploy B, verify -> merge/deploy C. **Never deploy B before A is live. Never deploy C before B is verified. From C onward, revert B => revert C first.**

---

## T-00 - Preparation (BASE)

**T-00 · Create per-delivery branches from BASE and verify a clean base**
- Objective: create one branch per delivery/repo from BASE (`main`) so A, B, C evolve independently and no prior working-branch changes are carried forward.
- Covers: process (plan §1/§2), "all tasks start from base".
- Repo: `backend/`, `frontend/` (git roots as applicable).
- Files: n/a (git metadata).
- Branches (suggested names): `sdd-003-a-frontend` (frontend), `sdd-003-b-backend` (backend), `sdd-003-c-frontend-cleanup` (frontend, created from the post-A state/base as appropriate but executed only after B is verified — record the exact base at execution time).
- Verification:
  - `git status` is clean on BASE before branching in each repo.
  - Each branch starts from the intended BASE commit (`git log -1 --oneline`).
  - `git diff --stat main...HEAD` (or equivalent) shows no unintended carry-over from the previous working branch.
- Expected state on BASE: n/a (manual).

**T-00b · Spec 002 retrospective exists before starting spec 003 (manual)**
- Objective: ensure `specs/002-integridad-estado-juego/retro.md` exists and reflects spec 002 outcomes before beginning spec 003 implementation, so process/learnings are captured (gap carried from prior planning).
- Covers: process/traceability (precondition).
- Repo: docs.
- Files: `specs/002-integridad-estado-juego/retro.md`.
- Verification: file exists and is reviewed; record completion before A implementation begins. Do not block this tasks-file edit; this is a manual pre-start gate.
- Expected state on BASE: n/a (manual).

> **CP-1 (review T-00, T-00b).** Review: branch names/bases are correct for A/B/C; `retro.md` for spec 002 exists (T-00b). Run `git status` and `git diff --stat` in `backend/` and `frontend/`: only the expected repo state (no stray files, no carried-over changes). Note: if CI runs on every push, **do not push red-test commits** (see B test tasks); push only when the corresponding delivery's quality gate is green.

---

## Delivery A - Tolerant frontend (frontend repo)

### A.1 - Test infrastructure

**A-01 · Vitest + React Testing Library setup + 1 smoke test**
- Objective: add minimal frontend test infrastructure (Vitest + React Testing Library, `fetch` mocked). No Playwright.
- Covers: plan §8 (T-A0, RF-8 infra), AC-10–AC-17 enabler.
- Repo: `frontend/`.
- Files: `frontend/package.json` (test script/devDeps), Vitest config (`vitest.config.*` or equivalent), RTL/test setup (e.g. `setup` file, `jsdom`/environment config), 1 smoke test file (component/render or trivial assertion).
- Verification: from `frontend/`, the new test command runs and the smoke test passes; `npm run build` and `npm run lint` still succeed (or record pre-existing lint issues separately).
- Expected state on BASE: **green** (new harness + smoke test; does not assert unimplemented spec behavior).

> **CP-2 (review A-01).** Review config is minimal and uses mocked `fetch` (no Playwright). `git status` / `git diff --stat` in `frontend/`: only test-infra files and `package.json`/lockfile changes expected from A-01.

### A.2 - Frontend tests BEFORE implementation (must fail for the right reason)

All A.2 tests use Vitest + RTL with mocked `fetch` and assert the spec UI messages/actions (exact Spanish strings where fixed) and behavior. **Do not implement production handling before these tests exist.** Run against BASE frontend behavior.

**A-02 · Guess 404 discrimination (exact strings) — AC-10, AC-11**
- Objective: assert 404 `{"error":"Game not found"}` shows `Esta partida ya no existe` + start-new-game control and no blank page/no appended error; 404 `{"error":"Player not found"}` shows `Jugador no encontrado`, input enabled, selected player kept, prior guesses visible, no appended error.
- Covers: AC-10, AC-11, RF-8, RF-9 (plan §3, §8).
- Repo: `frontend/`.
- Files: frontend test file(s) for `app/game/page.tsx` / guess flow (placement per A-01 conventions).
- Verification: run the A-02 tests.
- Expected state on BASE: **red (expected).** Reason: BASE appends every body and returns `(<></>)` on any `g.error` (`frontend/app/game/page.tsx:33-37`), with no `res.ok`/discrimination/messages/actions — tests will not find the specified messages/actions and/or will observe blank/error-appended behavior.

**A-03 · Guess 404-other and 400 — AC-12, AC-14**
- Objective: assert 404 with unrecognized `error` (not exactly `"Game not found"`/`"Player not found"`) shows `Algo salió mal. Inténtalo de nuevo.`, input enabled, never shows `Esta partida ya no existe`, no append; 400 validation shows `Solicitud no válida.`, input enabled, no append.
- Covers: AC-12, AC-14, RF-8, RF-9.
- Repo: `frontend/`.
- Files: frontend test file(s) for guess flow.
- Verification: run A-03 tests.
- Expected state on BASE: **red (expected).** Reason: no status/body discrimination or spec messages; BASE blanks on any `{ error }`.

**A-04 · Guess 500/network and legacy tolerance — AC-13, AC-15 (transitory)**
- Objective: assert 500/network on guess shows `Algo salió mal. Inténtalo de nuevo.`, re-enables input, keeps selected player, no auto-resend, preserves guesses already shown, no append; legacy `HTTP 200 + { "error": "Game not found" }` / `"Player not found"` is treated as an error by exact string (AC-10/AC-11 behavior), not appended, no blank page.
- Covers: AC-13, AC-15 (transitory in delivery A), RF-8, RF-9, RF-10.
- Repo: `frontend/`.
- Files: frontend test file(s) for guess flow.
- Verification: run A-04 tests.
- Expected state on BASE: **red (expected).** Reason: BASE has no `try/catch`/`res.ok` handling, blanks on `{ error }`, and does not preserve/keep selected player; auto-resend absence and legacy-as-error discrimination are not implemented.

**A-05 · PlayerInput search failure (live path) — AC-16, RF-11**
- Objective: assert network/5xx on the **live** search path (`debouncedSearch`/`handleChange`, `frontend/app/components/PlayerInput.tsx:14-35`) shows non-blocking `Algo salió mal. Inténtalo de nuevo.` under the input, no auto-retry; cleared on next successful search; `[]` (no results) is not an error and shows no error message. `handleSearch` (`:68-81`) is dead (verified, not referenced) — **suggestion out of scope (spec 004)**, do not target it.
- Covers: AC-16, RF-11, OD-1 (plan §3).
- Repo: `frontend/`.
- Files: frontend test file(s) for `app/components/PlayerInput.tsx`.
- Verification: run A-05 tests.
- Expected state on BASE: **red (expected).** Reason: BASE has no error handling on search fetch (`:26`) and no non-blocking error state/message.

**A-06 · Game start failure — AC-17, RF-12**
- Objective: assert `POST /api/game/start` failure (4xx/5xx/network) shows `Algo salió mal. Inténtalo de nuevo.` and a `Retry` control that calls start again; no auto-retry.
- Covers: AC-17, RF-12.
- Repo: `frontend/`.
- Files: frontend test file(s) for `app/game/page.tsx` start flow.
- Verification: run A-06 tests.
- Expected state on BASE: **red (expected).** Reason: BASE start effect (`frontend/app/game/page.tsx:12-18`) has no `res.ok`/`catch`/error UI/retry.

> **CP-3 (review A-02–A-06).** Review: every frontend AC (AC-10–AC-17) has a test task; tests fail for the intended reasons on BASE (blank-on-`{error}`, missing discrimination/messages/actions/retry, no catch). `git status` / `git diff --stat` in `frontend/`: only test files (and any A-01 follow-ups) expected. **Do not push red-test commits if CI runs on push** — hold until **CP-4** (A implementation + gate green).

### A.3 - Implementation (small tasks)

**A-07 · Game page: guess/start-safe error handling, exact discrimination, tolerance, state preservation**
- Objective: implement explicit error handling in `game/page.tsx` for guesses (and shared primitives) so AC-10–AC-15 pass: detect failures by `res.ok`/`error` presence/`catch`; **never append error bodies to `guesses`**; **never render blank page** on `{ error }`; exact-string discrimination for `"Game not found"`/`"Player not found"` (404 and legacy 200); 404-other → generic, never "partida no existe"; 500/network → generic, re-enable input, keep selected player, **no auto-resend**, preserve shown guesses; 400 → `Solicitud no válida.`; transition tolerance (RF-10, AC-15 transitory). Never render backend error text.
- Covers: AC-10, AC-11, AC-12, AC-13, AC-14, AC-15 (transitory), RF-8, RF-9, RF-10 (plan §3).
- Repo: `frontend/`.
- Files: `frontend/app/game/page.tsx`; `frontend/app/components/PlayerInput.tsx` only if minimal prop/state coordination is required to "keep selected player" (keep scope tight); optional shared UI-constants module for fixed strings (implementation choice).
- Verification: A-02, A-03, A-04 pass; manual sanity that normal win/loss flow still works.
- Expected state on BASE: n/a (implementation turns A-02–A-04 green).

**A-08 · Game page: start failure + Retry (no auto-retry)**
- Objective: handle `POST /api/game/start` 4xx/5xx/network with `Algo salió mal. Inténtalo de nuevo.` and a `Retry` control that calls start again; no auto-retry.
- Covers: AC-17, RF-12 (plan §3).
- Repo: `frontend/`.
- Files: `frontend/app/game/page.tsx` (and shared constants if used).
- Verification: A-06 passes.
- Expected state on BASE: n/a.

**A-09 · PlayerInput: non-blocking search error (live path only)**
- Objective: on network/5xx for the live search path, show non-blocking `Algo salió mal. Inténtalo de nuevo.` under the input; clear on next successful search; `[]` not an error; no auto-retry. Do not change/expand dead `handleSearch` (out of scope, spec 004).
- Covers: AC-16, RF-11, OD-1 (plan §3).
- Repo: `frontend/`.
- Files: `frontend/app/components/PlayerInput.tsx` (live path: `:14-35`/fetch `:26`), shared constants if used.
- Verification: A-05 passes.
- Expected state on BASE: n/a.

**A-10 · Frontend quality gate (delivery A)**
- Objective: confirm the frontend delivery is buildable/lintable/test-green.
- Covers: plan §2 (A verification), §8.
- Repo: `frontend/`.
- Files: n/a (command outputs / fixes limited to A scope if required).
- Verification: from `frontend/`, run Vitest (all A-02–A-06 + smoke pass), `npm run build`, `npm run lint` (record pre-existing lint issues separately if any; do not expand scope).
- Expected state on BASE: n/a.

> **CP-4 (review A implementation).** Review: A-02–A-06 green; no error body appended to guesses; no blank page; exact-string discrimination; messages/actions match spec table (search copy confirmed). `git status` / `git diff --stat` in `frontend/`: only `app/game/page.tsx`, `app/components/PlayerInput.tsx`, test files, test config/setup, and `package.json`/lockfile as needed — no backend files, no spec/plan/contract edits.

### A.4 - Local verification (manual, git worktree)

**A-V1 · Local matrix (manual, limited: base/base + A/base only)**
- Objective: verify delivery A against the old backend contract locally before merge/deploy. **At this stage only base/base and new(A frontend)/base can be verified** because delivery B backend is not merged/deployed yet.
- Covers: AC-18 (cases 1–2 now), plan §2/§8/§9.
- Repo: local worktrees / `frontend/` + `backend/`.
- Files: n/a.
- Procedure (manual):
  - Use `git worktree` to run **BASE backend** (and keep A frontend) using the same development database subject to spec-002 safeguards (Jest host/`DATABASE_URL` guard, test-data cleanup). Point the frontend at each via `NEXT_PUBLIC_API_URL`.
  - **Next.js note:** `NEXT_PUBLIC_*` is **inlined at build time**; in `next dev` **restart the dev server** when changing `NEXT_PUBLIC_API_URL` (or use separate builds/starts per target).
  - Run the verifiable cases and record results:
    | # | Frontend | Backend | Verifiable now? | Expected |
    |---|---|---|---|---|
    | 1 | Base (old) | Base (old) | Yes | Unchanged baseline. |
    | 2 | A (tolerant) | Base (old) | Yes | Legacy `200 {error}` handled by exact string; no blank page; no appended guess; spec messages/actions. |
    | 3 | A (tolerant) | B (new) | No (B not merged) | Verified in **B-V1** after B implementation. |
    | 4 | Base (old) | B (new) | No (B not merged) | Observed in **B-V1** (controlled inverted-order regression). |
- Verification: cases 1–2 pass before merging A. Document any environment constraint as **unverified** (CI/hosting/per-env `NEXT_PUBLIC_API_URL` config not present in repo).
- Expected state on BASE: n/a (manual).

> **CP-5 (review A local verification).** Review: matrix cases 1–2 evidence recorded (only verifiable cases at this point); Next.js inlining/restart noted. `git status` / `git diff --stat` in `frontend/` and `backend/`: only intended A/frontend changes (backend untouched in A). Proceed to merge/deploy A only after CP-4 + CP-5.

### A.5 - Merge and deploy A (manual)

**A-D1 · Merge and deploy delivery A + quick production smoke (manual)**
- Objective: deploy tolerant frontend first (expand).
- Covers: plan §2/§9, AC-18 (case 2 in prod-like env).
- Repo: `frontend/` (deployment mechanics **unverified** in repo).
- Files: n/a.
- Verification (manual): merge A branch per repo process; deploy A; quick production smoke on start/search/guess flows confirms tolerant handling (no blank page on legacy `200 {error}`); record environment details. **Do not deploy B before A is live.**
- Expected state on BASE: n/a.

> **CP-6 (post-A deploy).** Review: A live, smoke OK. `git status` clean on deployed branches. If CI runs on push, confirm no red tests were pushed.

---

## Delivery B - Backend contract (backend repo)

### B.1 - Characterization tests (GREEN on BASE, guard refactor)

**B-01 · Players routes characterization tests (pass on BASE, must survive refactor)**
- Objective: capture current external behavior of `backend/src/routes/players.ts` before migrating to `asyncHandler`+middleware. Must pass on BASE and still pass after refactor.
- Covers: AC-9, RF-7 (plan §4, §8).
- Repo: `backend/`.
- Files: new/updated backend test file for players routes (e.g. `backend/src/test/players.routes.test.ts` or alongside existing tests).
- Assertions (BASE-aligned, verified):
  - `GET /api/players` induced failure → **500** body exactly `{ "error": "Error fetching players" }` (BASE `routes/players.ts:6-13`). **Preserve** after refactor.
  - `GET /api/players/random` induced failure → **500** body exactly `{ "error": "Error selecting player" }` (`:15-23`). **Preserve** after refactor.
  - `GET /api/players/search` with `q` empty/missing → **200** `[]` (unchanged).
  - `GET /api/players/search?q=<value>` internal failure → **500** body exactly `{ "error": "Internal Server Error" }` (generic). BASE has no try/catch (`:25-52`) but **Express 5.2.1** (`backend/package.json`) auto-forwards async rejections to `errorHandler`, so the request reaches middleware and returns 500 generic — it does **not** hang. Characterization reflects this real behavior (RF-7/OD-5).
- Test technique: induce failures via Prisma spy/mock (no test routes added to the app). Reuse spec-002 safeguards (Jest host/`DATABASE_URL` guard, test-data cleanup) without redefining them.
- Verification: `npx jest --forceExit <players-test>` passes on BASE.
- Expected state on BASE: **green** (regression/characterization of current behavior).

> **CP-7 (review B-01).** Review: characterization passes on BASE and asserts exact `/` and `/random` messages plus `/search` generic 500 (Express 5 async, not hung). `git status` / `git diff --stat` in `backend/`: only the new/updated players characterization test file(s) expected.

### B.2 - New tests (declare BASE state per assertion) + existing test update

**B-02 · Game session-not-found 404 exact strings — AC-1, AC-2**
- Objective: assert `GET /api/game/999999999` → 404 `{"error":"Game not found"}`; `POST /api/game/999999999/guess` with valid body → 404 `{"error":"Game not found"}` and no `Guess` created for that session id.
- Covers: AC-1, AC-2, RF-1, RF-2, OD-4 (plan §4, §8).
- Repo: `backend/`.
- Files: backend integration test file (e.g. `backend/src/test/api-contract-errors.test.ts` or `game-state-integrity.test.ts`).
- Verification: run B-02 tests against BASE.
- Expected state on BASE (per assertion):
  - `GET /api/game/:id` unknown → 404 `"Game not found"`: **red**. Reason: BASE returns **200** `{ "error": "Game not found" }` (`game.service.ts:60-62`; `game.controller.ts:38` returns `res.json`).
  - `POST /api/game/:id/guess` unknown session, valid body → 404 `"Game not found"` + no guess for id: **red**. Reason: BASE returns **200** `{ "error": "Game not found" }` (`game.service.ts:106-108`; `game.controller.ts:31-32`).

**B-03a · Validation and finished-game behavior unchanged (regression) — AC-5, AC-6**
- Objective: (AC-5) invalid bodies (`playerId` -1, `"x"`, `{}`) → 400 with `"error":"Validation error"` and `details`; (AC-6) known finished game → 400 exact `"Game already finished"`.
- Covers: AC-5, AC-6, RF-5.
- Repo: `backend/`.
- Files: backend integration test file.
- Verification: run B-03a tests against BASE.
- Expected state on BASE (per assertion):
  - AC-5 invalid bodies → 400 `Validation error` + `details`: **green (regression)**. Reason: `guessSchema.parse` throws `ZodError` (`controllers/game.controller.ts:28`; `validations/game.validation.ts:3-5`) and BASE middleware maps it to 400 `{ error, details }` (`error.middleware.ts:11-16`).
  - AC-6 known finished game → 400 `"Game already finished"`: **green (regression)**. Reason: service throws `"Game already finished"` (`game.service.ts:110-112`) and BASE middleware maps it to 400 (`error.middleware.ts:21-23`); routes use `asyncHandler` (Express 5 forwards async rejections).

**B-03b · Error precedence on guess — AC-7 (and AC-3 unknown-player precedence case)**
- Objective: assert precedence in explicit order/structure: (1) invalid body → 400; (2) unknown game id (valid body) → 404 `"Game not found"`; (3) known finished game → 400 `"Game already finished"`; (4) unknown `playerId` on known in-progress game → 404 `"Player not found"`. **`(pte AC-7)` in coverage means AC-7 is covered by B-03b** (not by B-03a). Case (4) also exercises AC-3 behavior; B-06 remains the T-09 no-mutation update for AC-3.
- Covers: AC-7, AC-3 (precedence case 4), RF-5 (plan §4/§8).
- Repo: `backend/`.
- Files: backend integration test file.
- Verification: run B-03b tests against BASE.
- Expected state on BASE (per assertion):
  - (1) invalid body → 400: **green (regression)**. Reason: Zod validation runs before service lookup yields 400 (`controllers/game.controller.ts:28`; `error.middleware.ts:11-16`).
  - (2) unknown game, valid body → 404 `"Game not found"`: **red**. Reason: BASE returns **200** `{ "error": "Game not found" }` (`game.service.ts:106-108`).
  - (3) known finished game → 400 `"Game already finished"`: **green (regression)**. Reason: same as AC-6.
  - (4) unknown `playerId`, known in-progress game → 404 `"Player not found"`: **red**. Reason: BASE returns **200** `{ "error": "Player not found" }` (`game.service.ts:131-133`).

**B-04 · Real error through middleware (Prisma spy + real route) — AC-8, RF-6**
- Objective: make a Prisma method fail with a spy and call a **real route** (no test routes added to the app); assert HTTP 500 JSON `{ "error": "Internal Server Error" }` with correct status, proving the handler/mapping path. Confirms middleware registration is effective (target registration: before `app.listen` and after routes per RF-6; B-08 fixes BASE order).
- Covers: AC-8, RF-6 (plan §4, §8).
- Repo: `backend/`.
- Files: backend integration test file; uses exported `app`.
- Verification: run B-04 against BASE.
- Expected state on BASE (per assertion):
  - Prisma-spy-induced rejection on a real route → 500 `{"error":"Internal Server Error"}` JSON: **green (regression)**. Reason (BASE, verified): game routes use `asyncHandler` and Express 5.2.1 forwards async rejections; `errorHandler` maps unknown errors to 500 generic and logs (`error.middleware.ts:25-32`). Although BASE registers `errorHandler` after `app.listen` (`server.ts:33-37`), Express applies middleware registered on the `app` instance to requests handled by that app (supertest uses the exported `app`), so the generic 500 mapping is observable. B-08 still corrects registration order.

**B-05 · Null secret → 500 generic + Pino log detail (unit/mock) — AC-4, RF-4**
- Objective: unit test with **Prisma mocked** to simulate a session whose resolved secret is `null`; **spy on the Pino logger exported by `backend/src/lib/logger.ts`**; assert 500 body exactly `{ "error": "Internal Server Error" }`, diagnostic detail is logged via that logger, and the response body exposes no detail.
- Covers: AC-4, RF-4 (plan §4, §8).
- Repo: `backend/`.
- Files: backend unit test (e.g. `backend/src/test/game.service.test.ts` or new focused unit file); logger target `backend/src/lib/logger.ts` (Pino).
- Verification: run B-05 against BASE.
- Expected state on BASE (per assertion):
  - Null secret → 500 `{"error":"Internal Server Error"}` with no detail in body: **red**. Reason: BASE returns **200** `{ "error": "Game not found" }` when secret resolves null (`game.service.ts:151-153`).
  - Diagnostic detail logged via Pino logger (`lib/logger.ts`): **red**. Reason: BASE does not implement the required 500-generic + logged-detail contract for this case. Prisma schema makes integration impossible (`GameSession.secretPlayerId` non-nullable `Int` with FK, `schema.prisma:33-41`).

**B-06 · Update T-09 (player not found 404, keep no-mutation) — AC-3, RF-3**
- Objective: update the existing `T-09 — nonexistent playerId does not consume an attempt` in `backend/src/test/game-state-integrity.test.ts` (BASE ~266-298, asserts `status === 200`, no body assertion) to expect HTTP **404** and body exactly `{ "error": "Player not found" }`, **keeping** all assertions that `attempts`/`Guess` rows/`isFinished`/`isWin`/`score` are unchanged.
- Covers: AC-3, RF-3 (plan §7, §8).
- Repo: `backend/`.
- Files: `backend/src/test/game-state-integrity.test.ts`.
- Verification: run T-09 against BASE.
- Expected state on BASE (per assertion):
  - Status/body 404 `{"error":"Player not found"}`: **red**. Reason: BASE returns **200** `{ "error": "Player not found" }` (`game.service.ts:131-133`).
  - No mutation of attempts/Guess rows/finish/win/score: **green (regression)** on BASE (keep these assertions).

> **CP-8 (review B-02–B-06).** Review: every backend AC (AC-1–AC-9) is covered by characterization or a test task; each assertion's BASE state is declared (red with reason, or green regression). B-03a/B-04 are regression-green on BASE; B-02/B-03b(cases 2,4)/B-05/B-06(status) are red for the intended reasons. `git status` / `git diff --stat` in `backend/`: only intended backend test files. **Do not push red-test commits if CI runs on push** — hold until **CP-9** (B implementation + gate green).

### B.3 - Implementation (small tasks)

**B-07 · Service throws + controller propagation (game/player/not-found/null-secret, Pino log)**
- Objective: `getGameService`/`makeGuessService` throw `"Game not found"` (session missing) and `"Player not found"` (unknown `playerId`) instead of returning 200 `{error}`; for null secret, log diagnostic detail with the **Pino logger (`backend/src/lib/logger.ts`)** and yield the 500-generic path (not 404/not "Game not found"); controllers propagate rejections through `asyncHandler` without changing Zod/response shapes. Preserve spec-002 game/atomic logic and precedence (RF-5).
- Covers: AC-1, AC-2, AC-3, AC-4, AC-7, RF-1, RF-2, RF-3, RF-4, RF-5 (plan §4).
- Repo: `backend/`.
- Files: `backend/src/services/game.service.ts`, `backend/src/controllers/game.controller.ts` (and `routes/game.ts` only if a minimal propagation alignment is required; it already uses `asyncHandler`).
- Verification: B-02, B-03b (cases 2,4), B-05, B-06 pass (with B-08 for mapping/order); B-03a and B-04 remain green.
- Expected state on BASE: n/a.

**B-08 · Error middleware mappings + registration order (real error -> JSON)**
- Objective: map `"Player not found"`→404, `"Game not found"`→404, preserve `ZodError`→400+`details` and `"Game already finished"`→400, ensure null-secret path resolves to 500 `{"error":"Internal Server Error"}` (generic) and unknown errors → 500 generic logged via Pino; register `app.use(errorHandler)` **before `app.listen(...)` and after all routes** (BASE registers after listen, `server.ts:37` vs `:33-35`).
- Covers: AC-1–AC-8, RF-1–RF-6 (plan §4).
- Repo: `backend/`.
- Files: `backend/src/middleware/error.middleware.ts`, `backend/src/server.ts`.
- Verification: AC-1–AC-8, B-01 (search generic still via middleware) pass; app export remains usable by supertest.
- Expected state on BASE: n/a.

**B-09 · Players routes -> asyncHandler + middleware, preserve shapes**
- Objective: migrate `players.ts` to `asyncHandler`+centralized middleware while preserving: `GET /` failure 500 `{"error":"Error fetching players"}` (exact), `GET /random` 500 `{"error":"Error selecting player"}` (exact), `GET /search` internal failure 500 `{"error":"Internal Server Error"}` generic and `q` empty → 200 `[]`. (A naive refactor that genericizes `/`/`/random` must fail B-01.)
- Covers: AC-9, RF-7 (plan §4).
- Repo: `backend/`.
- Files: `backend/src/routes/players.ts`.
- Verification: B-01 characterization remains green pre/post change.
- Expected state on BASE: n/a.

**B-10 · Backend quality gate (delivery B)**
- Objective: full backend gate.
- Covers: plan §2/§8/§9.
- Repo: `backend/`.
- Files: n/a (scope-limited fixes only).
- Verification: `npx jest --forceExit`, `npm run build`, `npm run lint`, `npm run format` (from `backend/`), reusing spec-002 safeguards (host/`DATABASE_URL` guard, cleanup). Record any pre-existing lint issues separately.
- Expected state on BASE: n/a.

> **CP-9 (review B implementation).** Review: B-01 still green; AC-1–AC-9 (and updated T-09) green; middleware order fixed; null secret is 500 generic logged via Pino `lib/logger.ts` (not 404). `git status` / `git diff --stat` in `backend/`: only `src/services/game.service.ts`, `src/controllers/game.controller.ts`, `src/middleware/error.middleware.ts`, `src/server.ts`, `src/routes/players.ts` (and `game.ts` only if minimally needed), intended test files, and `src/lib/logger.ts` only if a minimal import/use change is required — no frontend/spec/plan/contract edits.

### B.4 - Local verification before B merge (manual, git worktree)

**B-V1 · Local full 4-combination matrix (manual, BEFORE B merge)**
- Objective: verify delivery A frontend + delivery B backend locally **before merging B**, using the full 4-combination matrix. Run on different ports, same development database with spec-002 cleanup/safeguards.
- Covers: AC-18 (cases 1–4), plan §2/§8/§9.
- Repo: local worktrees / `frontend/` + `backend/`.
- Files: n/a.
- Procedure (manual):
  - Use `git worktree` (or equivalent local checkouts) to run **BASE frontend**, **A frontend**, **BASE backend**, and **B backend** as needed on **different ports**, using the same development database subject to spec-002 safeguards (Jest host/`DATABASE_URL` guard, test-data cleanup). Point frontends via `NEXT_PUBLIC_API_URL`.
  - **Next.js note:** `NEXT_PUBLIC_*` is **inlined at build time**; in `next dev` **restart the dev server** when changing `NEXT_PUBLIC_API_URL` (or use separate builds/starts per target).
  - Run the full matrix and record results:
    | # | Frontend | Backend | Expected |
    |---|---|---|---|
    | 1 | Base (old) | Base (old) | Unchanged baseline. |
    | 2 | A (tolerant) | Base (old) | Legacy `200 {error}` handled by exact string; no blank page; no appended guess; spec messages/actions. |
    | 3 | A (tolerant) | B (new) | 404/404/404/500 contracts + UI per AC-10–AC-14,16–17. |
    | 4 | Base (old) | B (new) | **Inverted-order regression** (blank/incorrect) — observed only in controlled local check; confirms **never deploy B before A is live** (not a supported target). |
  - Complement with `curl` for exact status/body (see B-D1).
- Verification: cases 1–3 pass and case 4 shows the documented regression before merging B. Document any environment constraint as **unverified**.
- Expected state on BASE: n/a (manual).

> **CP-10 (review B-V1).** Review: full 4-combination matrix evidence recorded (including case 4 regression). `git status` / `git diff --stat` in `backend/` and `frontend/`: only intended B/backend changes plus A frontend state as needed for verification (no unintended edits). Proceed to merge/deploy B only after CP-9 + CP-10 and after A is live.

### B.5 - Merge and deploy B (manual)

**B-D1 · Merge and deploy delivery B + curl/production verification (manual)**
- Objective: deploy backend contract changes after A is live.
- Covers: AC-18 (case 3), plan §2/§8/§9.
- Repo: `backend/` (deployment mechanics **unverified** in repo).
- Files: n/a.
- Verification (manual):
  - Merge B after A is live; deploy B.
  - `curl` (phase 2+): `GET <BASE>/api/game/999999999` → 404 `{"error":"Game not found"}`; `POST <BASE>/api/game/999999999/guess` `{"playerId":1}` → 404 `{"error":"Game not found"}`; `POST <BASE>/api/game/<validId>/guess` `{"playerId":999999999}` → 404 `{"error":"Player not found"}`; invalid body → 400 with `Validation error` and `details`.
  - Quick production smoke on frontend flows confirms matrix case 3 behavior.
  - **Rollback:** before C, reverting B leaves tolerant A working (case 2). **Do not deploy C before B is verified. From delivery C onward, reverting B requires reverting C first.**
- Expected state on BASE: n/a.

> **CP-11 (post-B deploy).** Review: B live, `curl` + UI smoke OK (matrix case 3). `git status` clean on deployed branches.

---

## Delivery C - Frontend cleanup (frontend repo)

**Explicit condition:** execute C **only when B is deployed and verified** (CP-11 complete). Cleaning up before B is verified is unsupported (cleaned frontend + old backend = matrix case 4 regression).

**C-01 · Remove legacy `200 {error}` tolerance + adjust tests (AC-15 withdrawn)**
- Objective: remove the RF-10 transition branch that treats `HTTP 200 + { error }` as the old-backend surrogate. **AC-15 (tolerance to `200 + { error }`) is a transitory criterion withdrawn by C-01.** Retain `res.ok`/error-body handling for real 4xx/5xx, exact-string discrimination, all UI messages/actions, and "never append error body". Update A-04/AC-15 tolerance assertions to match post-cleanup contract (keep coverage meaningful for the real error contract).
- Covers: AC-15 (transitory, withdrawn by C-01), RF-10 removal (plan §5). Post-cleanup, AC-10–AC-14,16–17 remain the active frontend criteria under AC-18 case 3.
- Repo: `frontend/`.
- Files: `frontend/app/game/page.tsx` (and any shared helper added for tolerance), affected frontend tests.
- Verification: frontend tests pass; no legacy-200-tolerance path remains; manual/RTL check still handles 4xx/5xx correctly.
- Expected state on BASE: n/a (cleanup task).

**C-02 · Frontend quality gate (delivery C)**
- Objective: confirm cleanup is safe.
- Covers: plan §2/§5/§8.
- Repo: `frontend/`.
- Files: n/a.
- Verification: Vitest all pass, `npm run build`, `npm run lint` from `frontend/`.
- Expected state on BASE: n/a.

> **CP-12 (review C).** Review: legacy 200 tolerance removed; AC-15 treated as withdrawn; exact-string discrimination and messages preserved. `git status` / `git diff --stat` in `frontend/`: only A-07/A-08/A-09-era files and their tests as adjusted — no backend/spec/plan/contract edits.

**C-D1 · Merge and deploy delivery C + verification (manual)**
- Objective: complete expand/contract.
- Covers: AC-18 (case 3 maintained), plan §2/§5.
- Repo: `frontend/` (deployment **unverified**).
- Files: n/a.
- Verification (manual): merge/deploy C after B is verified; quick production smoke (guess 404/500/network/start/search flows) — no regression. **Spec 003 closes when C is done.** **From delivery C onward, reverting B requires reverting C first** (C removes frontend tolerance).
- Expected state on BASE: n/a.

> **CP-13 (post-C deploy / pre-close).** Review: C live, smoke OK. `git status` clean. Proceed to D (docs/close).

---

## Delivery D - Close (docs)

**D-01 · Update `AGENTS.md` (backend + frontend)**
- Objective: document new status semantics, error rule (`{error}`; validation keeps `details`; 404 game/player exact strings; null secret 500 generic, diagnostic detail logged via Pino `lib/logger.ts`), middleware order/behavior, players-handler style and preserved messages, and frontend test infrastructure (Vitest + RTL, mocked `fetch`, T-A0, no Playwright).
- Covers: constitution (keep AGENTS.md in sync), plan §7/§8.
- Repo: `backend/`, `frontend/` (repo docs).
- Files: `backend/AGENTS.md`, `frontend/AGENTS.md`.
- Verification: docs match implemented behavior and the spec/contract; `git diff --stat` shows only the two AGENTS files.
- Expected state on BASE: n/a.

**D-02 · Mark spec 001 points 4,5,6 and spec 002 findings resolved by 003**
- Objective: in `specs/001-estado-actual/spec.md` mark section 7 points **4, 5, 6** as resolved by spec 003 (with brief notes consistent with the contract) and mark the spec-002 follow-up findings (`Player not found` and null-secret returning 200 `{error}`) as resolved by spec 003. Keep history accurate.
- Covers: traceability (spec 001 §7, spec 002 open decisions / follow-ups).
- Repo: docs.
- Files: `specs/001-estado-actual/spec.md` (and `specs/002-integridad-estado-juego/*` only if it contains an explicit unresolved note to mark resolved — verify before editing; prefer minimal accurate changes).
- Verification: text references spec 003 and matches final status strings/semantics.
- Expected state on BASE: n/a.

**D-03 · Mark spec implemented, update roadmap, write retro (AC-15 state reflected)**
- Objective: mark spec 003 as implemented; update `specs/roadmap.md`; write `specs/003-contrato-y-errores/retro.md`. Reflect that **AC-15 was transitory and withdrawn by C-01** (legacy `200 {error}` tolerance removed after B verified).
- Covers: process/traceability, AC-15 state.
- Repo: docs.
- Files: `specs/003-contrato-y-errores/spec.md` (status marker only, if that is the repo convention — **verify** convention in spec 002/001), `specs/roadmap.md`, `specs/003-contrato-y-errores/retro.md`.
- Verification: roadmap/spec status consistent; retro exists and reflects actual outcomes/gaps including AC-15 withdrawal.
- Expected state on BASE: n/a.

> **CP-14 (close).** Review D-01–D-03. `git status` / `git diff --stat` in `backend/`, `frontend/`, and repo root: only AGENTS/roadmap/spec-status/retro files (and any spec-001/002 traceability notes) — no code or test changes.

---

## Coverage - AC / RF -> task

| AC / RF | Task(s) | Notes / expected on BASE (per assertion where split) |
|---|---|---|
| RF-1 | B-02, B-07, B-08 | GET 404 service throws → middleware. B-02 GET assertion **red** on BASE (200). |
| RF-2 | B-02, B-07, B-08 | POST guess session-not-found 404. B-02 POST assertion **red** on BASE (200). |
| RF-3 | B-03b (AC-7 case 4), B-06, B-07, B-08 | Player not found 404, no mutation. B-03b case 4 **red** (200); B-06 status **red** (200), no-mutation assertions **green** on BASE. |
| RF-4 | B-05, B-07, B-08 | Null secret 500 generic + Pino log detail (unit/mock + spy on `lib/logger.ts`). B-05 body **red**, log **red** on BASE (200). |
| RF-5 | B-03a, B-03b, B-07, B-08 | Zod/finished/precedence unchanged. B-03a **green** on BASE; B-03b cases 1,3 **green**, cases 2,4 **red** (declared per assertion). |
| RF-6 | B-04, B-08 | Middleware before `app.listen` + real error via Prisma spy/real route. B-04 **green** on BASE (500 generic observable via exported `app`; order still fixed by B-08). |
| RF-7 | B-01, B-09 | Characterization first (**green** on BASE), preserve `/`+`/random` exact, `/search` generic 500 (Express 5 async). |
| RF-8 | A-02–A-06, A-07, A-08, A-09 | No blank page, no append error body, explicit handling. **Red** on BASE. |
| RF-9 | A-02, A-03, A-04, A-07 | Exact-string discrimination; never render backend text. **Red** on BASE. |
| RF-10 | A-04, A-07, C-01 | Tolerance in A; **removed by C-01**. A-04 **red** on BASE. |
| RF-11 | A-05, A-09 | PlayerInput live path only; `handleSearch` dead = out of scope (spec 004). **Red** on BASE. |
| RF-12 | A-06, A-08 | Start failure + Retry, no auto-retry. **Red** on BASE. |
| AC-1 | B-02, B-07, B-08 | **red** on BASE (200). |
| AC-2 | B-02, B-07, B-08 | **red** on BASE (200). |
| AC-3 | B-03b (case 4), B-06, B-07, B-08 | B-03b case 4 **red** (200); B-06 status **red** / no-mutation **green** on BASE. |
| AC-4 | B-05, B-07, B-08 | **red** on BASE (200 "Game not found"); unit/mock + Pino `lib/logger.ts` spy. |
| AC-5 | B-03a, B-07/B-08 (regression) | **green** on BASE (400+details preserved). |
| AC-6 | B-03a, B-07/B-08 (regression) | **green** on BASE (400 finished preserved). |
| AC-7 | B-03b, B-07, B-08 | `(pte AC-7)` = covered by **B-03b**. Per assertion on BASE: (1) invalid→400 **green**; (2) unknown game→404 **red** (200); (3) finished→400 **green**; (4) unknown player→404 **red** (200). |
| AC-8 | B-04, B-08 | **green** on BASE (500 generic via exported `app`/Express 5/asyncHandler; registration order fixed by B-08). |
| AC-9 | B-01, B-09 | **green** on BASE (characterization); must stay green. |
| AC-10 | A-02, A-07 | **red** on BASE. |
| AC-11 | A-02, A-07 | **red** on BASE. |
| AC-12 | A-03, A-07 | **red** on BASE. |
| AC-13 | A-04, A-07 | **red** on BASE. |
| AC-14 | A-03, A-07 | **red** on BASE. |
| AC-15 | A-04, A-07, C-01, D-03 | **Transitory criterion — withdrawn by C-01** (legacy `200 {error}` tolerance removed after B verified). A-04 **red** on BASE (tolerance absent). Not active post-C; B-V1/B-D1 verify case 3 with real contract. |
| AC-16 | A-05, A-09 | **red** on BASE. |
| AC-17 | A-06, A-08 | **red** on BASE. |
| AC-18 | A-V1, B-V1, A-D1, B-D1, C-D1 | **manual** (local `git worktree` matrix: A-V1 cases 1–2, B-V1 full 4 before B merge, + `curl` + quick prod smoke). Deploy mechanics/env config **unverified** in repo. |

## Gaps / notes

- **AC-18 manual / deploy unverified:** CI, hosting, branches, preview/staging, and per-env `NEXT_PUBLIC_API_URL` configuration are not present in the repo (**unverified**). Local `git worktree` + `curl` + quick prod smoke is the defined verification (A-V1 limited, B-V1 full); real staging/prod execution must be coordinated.
- **Frontend test placement/naming:** file locations follow the A-01/Vitest conventions (implementation choice). `handleSearch` dead code in `PlayerInput.tsx:68-81` is **suggestion out of scope** (spec 004), not a task.
- **Spec UI-table caveat (not applied):** the spec UI table still carries a "Copy note" for search-failure text; the copy is confirmed in plan/tasks as `Algo salió mal. Inténtalo de nuevo.`. Tasks do **not** modify `spec.md`/contract.
- **No out-of-scope work added:** no `code` field, no idempotency/lost-response handling, no Playwright, no schema changes, no game-rule changes.

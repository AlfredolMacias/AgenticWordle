# Tasks — 002 Game State Integrity

Derived from `spec.md` and `plan.md` in this folder. Small, independently verifiable tasks (ideally one task = one commit). Tests precede implementation; tests that start red must fail for the right reason. The code change is entirely in **backend/** (plan §3–§7); plan §5 defines **no frontend tasks**, so none are included.

Each task: **ID · objective · covers · files · verification.**

## Finding from the code check (affects the red/green premise)

`makeGuessService` (`backend/src/services/game.service.ts:151-161`) **already persists** `isFinished: true`, `isWin`, `attempts`, and `score` on a win and on the 6th-attempt loss. Consequences:

- **AC-2 and AC-3 already pass** today (on the 6th attempt `guessCount == 5`, so the response’s `isFinished`/`secretPlayer` happen to be correct, and score/attempts are persisted). → **T-05 is regression coverage, green from the start.**
- **AC-9 also passes** today (a non-final guess ⇒ `isFinished` false, `secretPlayer: ""`). → the only red part of **T-07 is AC-6**.
- Genuinely red initially: **AC-1, AC-4, AC-5, AC-6, AC-7, AC-8** (T-04, T-06, T-07/AC-6, T-08) and **T-10**.
- Therefore **T-12** (finished guard) turns **T-06** green; **T-14a** turns AC-6 (T-07) green; **T-14c** turns AC-1/AC-8 (T-04) green; **T-14b** greens no new test (it re-homes existing persistence inside the transaction). **T-09** stays green throughout.

---

## Phase 0 — Setup & test infrastructure (backend)

**T-00 · Create the spec-002 branch**
- Objective: create the branch for this spec in the backend repository before any code/test work.
- Covers: process (plan introduction).
- Files: n/a.
- Verify: branch created (e.g. `git switch -c 002-integridad-estado-juego`), clean working tree.

**T-01 · Jest host safety guard**
- Objective: abort any Jest run whose `DATABASE_URL` host is not local.
- Covers: plan §7 (shared-database safeguards).
- Files: `backend/jest.config.ts`, new `backend/src/test/setup.ts` (`setupFilesAfterEnv`).
- Verify: run `npx jest` with a non-local `DATABASE_URL` → aborts with a clear message; local host → proceeds.

**T-02 · Test helper**
- Objective: helper to (a) read a session’s secret player and (b) return `N` players distinct from the secret (different `teamId`, `position`, `jerseyNumber`), recording every session id it creates/observes.
- Covers: plan §7; enables AC tests.
- Files: new `backend/src/test/helpers/game.ts`.
- Verify: typecheck/build (`npm run build` or `npx tsc --noEmit`); a smoke assertion returns a secret and N distinct players.

**T-03 · afterAll cleanup**
- Objective: delete tracked sessions in `afterAll`, deleting `Guess` rows first, then `GameSession` rows.
- Covers: plan §7 (no leaderboard/shared-state contamination).
- Files: `backend/src/test/helpers/game.ts`, the test files using it.
- Verify: after a run that starts a game, no leftover `GameSession`/`Guess` rows for the tracked ids.

> **CHECKPOINT A** — review T-00…T-03 and commit.

## Phase 1 — Tests (backend)

**T-04 · AC-1 + AC-8 (early win)** — *red initially.*
- Objective: assert an early win derives `isFinished`/`secretPlayer` from the session.
- Covers: AC-1, AC-8.
- Files: new `backend/src/test/game-state-integrity.test.ts`.
- Verify: `npx jest game-state-integrity` fails because an early win returns `isFinished:false` / `secretPlayer:""`.

**T-05 · AC-2 + AC-3 (final-attempt win/loss)** — *regression, green from the start (see Finding).*
- Objective: cover the 6th-attempt win (score 10) and loss (score 0).
- Covers: AC-2, AC-3.
- Files: same test file.
- Verify: passes against current code; protects the persistence reworked in T-14b.

**T-06 · AC-4 + AC-5 (guess after finish)** — *red initially.*
- Objective: assert a finished game rejects further guesses.
- Covers: AC-4, AC-5.
- Files: same test file.
- Verify: fails because the current code processes the guess instead of returning 400 `"Game already finished"`.

**T-07 · AC-6 + AC-9** — *red initially (AC-6 only); AC-9 green from the start.*
- Objective: `attempts` increments per guess; in-progress response derivation.
- Covers: AC-6, AC-9.
- Files: same test file.
- Verify: fails on AC-6 (persisted `attempts` does not increment per guess); AC-9 is regression.

**T-08 · AC-7 (persisted result shape)** — *red initially.*
- Objective: assert `Guess.result` is the hint object.
- Covers: AC-7.
- Files: same test file.
- Verify: fails because `Guess.result` is a boolean.

**T-09 · Nonexistent `playerId` does not consume an attempt** — *regression, passes from the start (protects the read-before-transaction ordering in T-12 and the transaction in T-14a).*
- Objective: assert an unknown `playerId` never mutates `attempts` or inserts a `Guess`.
- Covers: spec edge cases “Validation precedence” / “Game not found / Player not found” (coverage, not a new AC).
- Files: same test file.
- Verify: passes against current code; asserts the current `"Player not found"` response with `attempts` and `Guess` count unchanged.

**T-10 · RF-3 unit test (finished session throws)** — *red initially.*
- Objective: assert the service throws `"Game already finished"` for a finished session.
- Covers: RF-3.
- Files: new `backend/src/test/game.service.test.ts` (Prisma mocked).
- Verify: fails because the service does not throw `"Game already finished"`.

> **CHECKPOINT B** — review the test suite (each red fails for the intended reason; T-05/T-09 documented as regression) and commit.
> **CI note:** if the pipeline runs on every push, do **not** push the red-test commits; hold them until **CHECKPOINT C** (implementation green), then push together.

## Phase 2 — Implementation (backend)

**T-11 · Constants + finished predicate**
- Objective: add `MAX_ATTEMPTS = 6` and read-only `isGameFinished(session)` (`isFinished || attempts >= MAX_ATTEMPTS`).
- Covers: plan §2.
- Files: `backend/src/services/game.service.ts`.
- Verify: build; no test changes.

**T-12 · Reads before the transaction + finished guard**
- Objective: order reads as validation → game not found → game finished (throw `"Game already finished"`) → player not found, all before any write; a nonexistent `playerId` never consumes an attempt.
- Covers: RF-3, plan §3.
- Files: `backend/src/services/game.service.ts`.
- Verify: `npx jest game-state-integrity` → **T-06 goes green** (the `isFinished` flag is already persisted by current code, so the new guard is sufficient); **T-09 stays green**; T-04/T-07/T-08 remain red.

**T-13 · Persist the hint object**
- Objective: write the `comparePlayers` hint object to `Guess.result` instead of `isWinner`.
- Covers: RF-1, AC-7.
- Files: `backend/src/services/game.service.ts`.
- Verify: **T-08 (AC-7) goes green.**

**T-14a · Atomic attempt claim (transaction + `updateMany` + `attempts`)**
- Objective: `$transaction` (default isolation) with conditional `updateMany` (`isFinished:false`, `attempts < MAX_ATTEMPTS`, increment); 0 rows ⇒ `"Game already finished"`; read claimed `attempts`.
- Covers: RF-4, RF-5, AC-6, AC-4/AC-5 (atomic enforcement).
- Files: `backend/src/services/game.service.ts`.
- Verify: **AC-6 in T-07 goes green**; T-06 stays green.

**T-14b · Final state (win/loss + score)**
- Objective: set `isFinished`/`isWin`/`score` for a win and a 6th-attempt loss inside the transaction.
- Covers: RF-2 (persistence), AC-1/AC-2/AC-3 scoring.
- Files: `backend/src/services/game.service.ts`.
- Verify: **no new test goes green** (current code already persists these; T-05 stays green) — this re-homes existing behavior inside the transaction and is covered by regression.

**T-14c · Response derived from the persisted session**
- Objective: build the response from the persisted session (`isFinished` flag; `secretPlayer` = name when finished else `""`).
- Covers: RF-2, AC-1, AC-2, AC-3, AC-8, AC-9.
- Files: `backend/src/services/game.service.ts`.
- Verify: **T-04 (AC-1/AC-8) goes green**, completing the suite; all AC tests pass.

> **CHECKPOINT C** — full backend suite green (`npx jest`), review, commit and (if needed) push the held red-test commits.

## Phase 3 — Reconciliation script (backend)

**T-15 · Script with `--dry-run`, host print, and `--confirm`**
- Objective: `backend/scripts/reconcile-attempts.ts`, run via `ts-node`, idempotent, prints a change summary; sets `attempts` = number of persisted `Guess` rows and sets `isFinished = true` where `isWin` is true or the reconciled `attempts >= MAX_ATTEMPTS`. It **prints the target host** and requires `--confirm` when the host is not local.
- Covers: spec `Existing Data Impact`; plan §6.
- Files: new `backend/scripts/reconcile-attempts.ts`.
- Verify: run **against the local database first** — `--dry-run` prints the intended changes; a real run is a no-op on the second invocation; a non-local host without `--confirm` refuses.
- Note: the Jest host guard (T-01) applies only to the test runner and **not** to this script.

## Phase 4 — Final gate, deploy, docs

**T-16 · Final quality gate**
- Objective: run the full gate.
- Covers: plan §7/§8.
- Files: n/a.
- Verify (from `backend/`): `npm run lint`, `npm run format`, `npm run build`, `npx jest` — all succeed.

> **CHECKPOINT D** — review gate results before touching the deployed database.

**T-17 · Reconcile the deployed database (immediately before deploy)**
- Objective: run the script against the deployed (Railway) database just before deploying.
- Covers: plan §6/§8.
- Files: n/a.
- Verify: `--dry-run` (output reviewed), then real run with `--confirm`.

**T-18 · Manual deploy**
- Objective: deploy the new backend code.
- Covers: plan §8.
- Files: n/a.
- Verify: deployment completed (mechanism not detailed here).

**T-19 · Post-deploy reconcile + smoke**
- Objective: run the script again after deploy (old code could desync `attempts` in the gap) and smoke-test `/game`.
- Covers: plan §6/§8.
- Files: n/a.
- Verify: idempotent second run; manual smoke test passes.

**T-20 · Documentation**
- Objective: update `backend/AGENTS.md` (maximum 6 attempts; Jest host guard + test cleanup; reconciliation script) and mark points **1, 2, 3, and 12** of section 7 in `specs/001-estado-actual/spec.md` as resolved by spec 002.
- Covers: constitution §7 (keep AGENTS.md in sync).
- Files: `backend/AGENTS.md`, `specs/001-estado-actual/spec.md`.
- Verify: docs reflect the new behavior and the resolved points.

**T-21 · Concurrency test (optional)**
- Objective: with `Promise.all`, submit two guesses against a session with 5 attempts; expect one success, one 400 `"Game already finished"`, and `attempts = 6`.
- Covers: RF-5 (beyond the spec’s waived automated criterion).
- Files: `backend/src/test/game-state-integrity.test.ts`.
- Verify: passes deterministically; may be skipped if flaky against the shared dev database.

> **CHECKPOINT E** — review post-deploy results, docs, and the optional concurrency test; finalize.

---

## Order summary

T-00 → T-01 → T-02 → T-03 (**A**) → T-04…T-10 (**B**, CI note) → T-11 → T-12 → T-13 → T-14a → T-14b → T-14c (**C**) → T-15 → T-16 (**D**) → T-17 → T-18 → T-19 → T-20 → T-21 → (**E**). No frontend tasks.

## Gaps

- **Manual dev-DB precondition** (verify `DATABASE_URL` ≠ Railway) is a human check at CHECKPOINT A/B, not code.
- **Deploy mechanism unspecified** (T-18 is manual, no tooling detail).
- **No automated coverage for the Jest host guard (T-01)**; verified manually. The script’s host guard (T-15) is separate and intentionally not covered by T-01.
- **RF-5 concurrency** is only optionally tested (T-21); the spec explicitly waives an automated concurrent-test criterion.
- **Test-file placement** (`game-state-integrity.test.ts`, `game.service.test.ts`) is a plan-level choice.
- **Finding (not a gap):** AC-2, AC-3, AC-9, and T-09 already pass against current code; only AC-1/AC-4/AC-5/AC-6/AC-7/AC-8 and T-10 are red initially.

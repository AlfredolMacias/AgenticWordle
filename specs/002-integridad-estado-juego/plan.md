# Plan — 002 Game State Integrity

Implementation plan derived from `specs/002-integridad-estado-juego/spec.md`. Every item below traces to a requirement (RF-x) or acceptance criterion (AC-x) of that spec. The “Discarded alternatives” section records options that were considered and rejected.

## 1. Approach summary

Make the persisted `GameSession` the single source of truth. Centralize the change in `makeGuessService`: guard by a read-only `isGameFinished(session)` helper, claim each attempt atomically with a conditional `updateMany`, persist the hint object in `Guess.result`, derive `isFinished`/`secretPlayer`/`attempts`/`score` from the persisted session, and build the response from that state. No Prisma schema migration is required; legacy data is handled by a one-time reconciliation script.

## 2. Data model changes

- **No Prisma migration.** The finished state already exists as persisted fields: `GameSession.isFinished`, `isWin`, `attempts`, `score` (`backend/prisma/schema.prisma:32-41`); `Guess.result` is already `Json` → `JSONB`. This matches spec 002 (“No changes to the Prisma schema… are required”).
- **Constant:** define `MAX_ATTEMPTS = 6` once in the game service module and reuse it everywhere (guard, scoring, script).
- **Read-only finished predicate:** `isGameFinished(session)` returns `session.isFinished || session.attempts >= MAX_ATTEMPTS`. It only reads and never mutates.
- **Data reconciliation** (not schema): a one-time script for `attempts` and `isFinished` (see §6).

## 3. Backend changes

**`backend/src/services/game.service.ts`**
- Add `MAX_ATTEMPTS = 6` and `isGameFinished(session)`.
- Rewrite `makeGuessService` (`:87-185`) so that **all reads happen before the transaction**, in this exact order (the spec’s validation precedence: invalid input → game not found → game finished → player not found):
  1. **Input validation** happens earlier in the controller (Zod `guessSchema`), unchanged.
  2. **Game not found:** load the session; keep the current “Game not found” handling unchanged.
  3. **Game finished (read-only guard):** if `isGameFinished(session)` → throw `new Error("Game already finished")` so `errorHandler` maps it to 400. This replaces the current `guessCount > 5` block (`:100-105`).
  4. **Player not found:** look up the guessed player and the secret player (unchanged selects) here, before any write. Keep the current “Player not found” handling. Because this lookup precedes the transaction, **a nonexistent `playerId` never consumes an attempt**.
- **Transaction (writes only):** after the reads above, open a `prisma.$transaction` with **default isolation** (no Serializable) containing only writes and the transaction-guarded `attempts` read:
  - **Atomic attempt claim:** conditional `updateMany` with `where: { id: gameId, isFinished: false, attempts: { lt: MAX_ATTEMPTS } }`, `data: { attempts: { increment: 1 } }`.
    - If it affects **0 rows**, throw `"Game already finished"` (the transaction rolls back).
    - Read the claimed session back inside the transaction to get the authoritative `attempts` (= attempt number); this read is serialized by the transaction itself.
  - `comparePlayers(secret, guessed)` unchanged; persist `result: <hints object>` instead of the boolean (`:168`).
  - Final state within the same transaction: win → `isFinished:true, isWin:true, score = scoreTable[attempts-1]`; 6th loss (`attempts === MAX_ATTEMPTS`) → `isFinished:true, isWin:false, score:0`.
  - Build the response from the persisted session: `isFinished` from the session, `secretPlayer` = secret name when finished else `""`.
- `comparePlayers` (`:5-22`): logic unchanged; its object is now persisted.
- `getTopGamesService` and the rest: unchanged (no reader of `Guess.result`).

**`backend/src/middleware/error.middleware.ts`** — no change (already maps `"Game already finished"` → 400 at `:21-23`).
**`backend/src/controllers/game.controller.ts`** — no change (Zod stays first at `:22`).

**New: `backend/scripts/reconcile-attempts.ts`** — see §6.

## 4. API contract changes

`POST /api/game/:id/guess`:

| Aspect | Before | After |
|---|---|---|
| `isFinished` | `guessCount == 5` (false on early wins) | persisted flag; `true` when the game ends |
| `secretPlayer` | name only on the 6th; `""` otherwise | name whenever the game ends, incl. early wins |
| `result` (response) | hint object | unchanged |
| Max reached | 200 `{ message, error: true }` | removed; the game is already finished |
| Guess after finished | processed | 400 `{ "error": "Game already finished" }` |

`GET /api/game/:id`, `POST /api/game/start`, daily, leaderboard and `/api/players/*`: unchanged.

## 5. Frontend changes

**None.** The `result` response shape is unchanged (`frontend/app/components/GuessRow.tsx:15-19`), and the new `isFinished`/`secretPlayer` values only make existing UI behave correctly (`frontend/app/game/page.tsx:39,44` disables input when the game ends; `:63-66` keeps the loss banner). The HTTP-400 handling at `frontend/app/game/page.tsx:34-37` (currently renders empty on `{error}`) is a **candidate for spec 003**, not changed here.

## 6. Existing data

- **Legacy `Guess.result` (booleans):** left as-is and ignored (no backend reader, verified). The new hint-object format applies only forward. No backfill.
- **`GameSession.attempts` legacy:** one-time **`backend/scripts/reconcile-attempts.ts`**, run manually with `ts-node`:
  - Idempotent; supports `--dry-run` and prints a change summary.
  - For each session, set `attempts` = number of persisted `Guess` rows.
  - Also set `isFinished = true` when `isWin` is `true` **or** the reconciled `attempts >= MAX_ATTEMPTS`.
- **Execution order:** because the script is idempotent, run it **twice** — once **just before deploying** the new code (with `--dry-run` first) and once **just after** deploying (see §8). Between those two moments the old code is still live and can leave `attempts` desynchronized, so the post-deploy run catches anything the pre-deploy run missed.
- The script may also touch residual **test data** (sessions/guesses created by the test suite), since tests run against the development database.

## 7. Testing strategy (AC → test)

Integration tests: Jest + supertest against the exported `app`, running against the **same development database that the seed populates** (no separate test database). Seeded data is the source of players and sessions, consistent with `backend/AGENTS.md` (“Tests use supertest against the exported `app` and require a seeded database”).

**New test helper** (`backend/src/test/helpers/game.ts`): uses Prisma against the development database to (a) read a session’s secret player (the API hides it until the game ends) and (b) return `N` players distinct from the secret (differing `teamId`, `position`, `jerseyNumber`), for wrong guesses.

**Shared-database safeguards** (mandatory, because tests mutate the development database):
- **Precondition check:** before running, verify that the development `DATABASE_URL` does **not** point at the deployed (Railway) database. If this cannot be guaranteed, treat it as a **blocking risk**.
- **Jest setup guard:** abort the run if the host of `DATABASE_URL` is not local.
- **Cleanup:** the test helper records the ids of the sessions it creates and deletes them in `afterAll`, deleting `Guess` rows first and then the `GameSession` rows, so it does not contaminate the leaderboard or shared state.
- Tests must tolerate pre-existing data and never assume an empty database.

| AC | Test |
|---|---|
| AC-1 | start → read secret → guess secret: `isWinner`, `isFinished`, `attempts=1`, `score=100`, `secretPlayer` |
| AC-2 | 5 wrong guesses → 6th = secret: `attempts=6`, `score=10`, `isFinished`, `secretPlayer` |
| AC-3 | 6 wrong guesses: `isWin=false`, `attempts=6`, `score=0`, `isFinished`, `secretPlayer` |
| AC-4 | after a win, new guess → 400 `"Game already finished"`; `attempts` and `Guess` count unchanged |
| AC-5 | after a loss, new guess → 400; `attempts` and `Guess` count unchanged |
| AC-6 | 3 in-progress guesses: persisted `attempts` = 1, 2, 3 |
| AC-7 | after a guess, `prisma.guess.findFirst`: object with the five hint keys, not a boolean |
| AC-8 | same test as AC-1 (early win): `isFinished=true` and secret revealed |
| AC-9 | in-progress guess: `isFinished=false`, `secretPlayer=""` |
| RF-3 | unit (service with a mocked/committed `isFinished` session): throws `"Game already finished"` |
| RF-5 | no automated concurrency test (spec note); verified by the conditional `updateMany` + single transaction |
| Edge case — nonexistent `playerId` (not a new AC) | guess with an unknown `playerId` returns the current `"Player not found"` error and leaves both `attempts` and the `Guess` count unchanged (covers the spec’s “Game not found / Player not found” edge case and reinforces that a rejected player never consumes an attempt) |

Final gate: `npx jest`, `npm run lint`, `npm run format`, `npm run build`.

## 8. Risks and recommended execution order

Risks:
- `guessCount` semantics: the attempt number must come from the claimed `attempts` inside the transaction, not from a stale pre-read.
- Concurrency: default isolation is accepted; correctness relies on the conditional `updateMany` predicate (`isFinished false`, `attempts < 6`); 0 rows ⇒ `"Game already finished"`.
- Tests run against the **shared development database**, so each run creates real `GameSession`/`Guess` rows and mutates shared state. Mitigations: the precondition check that `DATABASE_URL` is not the deployed database, the Jest setup guard aborting on a non-local host, the test helper’s `afterAll` cleanup (delete `Guess` then `GameSession`), and tests that tolerate pre-existing data.
- **Blocking risk:** if the development `DATABASE_URL` cannot be guaranteed to differ from the deployed (Railway) database, tests and the reconciliation script could corrupt production data. Resolve this before proceeding.
- Tests depend on seeded data and on finding enough “wrong” players for the chosen secret.
- **The reconciliation script must run before and after deploying the new code**: before, or legacy `attempts`/`isFinished` may misclassify finished games; after, because the old code can still desynchronize `attempts` in the gap. The post-deploy run may also touch residual test data.
- Frontend still renders empty on an unexpected 400 (deferred to spec 003).

Order:
1. `makeGuessService` + `MAX_ATTEMPTS` + `isGameFinished`; move all reads before the transaction.
2. Confirm error mapping; remove the obsolete max-guess path.
3. Add the test helper (with cleanup) and the AC tests, including the nonexistent-`playerId` edge case.
4. `jest`, `lint`, `format`, `build`.
5. Write `reconcile-attempts.ts`; run it **before** deploy (`--dry-run` first) and again **after** deploy (idempotent).
6. Optional manual smoke test.

## 9. Discarded alternatives

- Deriving “finished” solely from `attempts >= 6 || isWin`: the spec defines the persisted `isFinished` flag as authoritative; `attempts >= 6` is only a defensive fallback inside `isGameFinished`.
- Serializable isolation or an explicit row lock: rejected in favor of a conditional `updateMany` under default isolation.
- Backfilling legacy `Guess.result`: no reader; the spec leaves it.
- Keeping the 200 `{message, error}` response when attempts are exhausted: contradicts AC-4/AC-5 (400).
- Reconciling `attempts` via a Prisma migration: it is data, not schema; the constitution forbids editing applied migrations.
- Using a dedicated/isolated test database: tests run against the existing seeded development database instead.
- Frontend changes for early-win secret display or 400 handling: out of scope (400 handling noted for spec 003).
- `finishedAt`/timestamps: out of scope.

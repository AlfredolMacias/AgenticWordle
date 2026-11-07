# Roadmap

Lightweight roadmap; one entry per spec. No full specs.

## Entries

| ID | Name | Status | Objective (1-2 lines) | Repos affected | Dependencies | Open questions |
|---|---|---|---|---|---|---|
| 001 | Current state | done | Document how the running Express stack behaves today, including known inconsistencies and quirks in `specs/001-estado-actual/spec.md`. | backend, frontend | — | — |
| 002 | Game state integrity | done | Make the persisted `GameSession` the single source of truth: derive `isFinished`/`secretPlayer` from the session, persist `Guess.result` as the hint object, increment `attempts` per accepted guess atomically, reject guesses after finish with `Game already finished` (400). Reconciled legacy `attempts`/`isFinished` via `scripts/reconcile-attempts.ts`. | backend | 001 | None carried to completion for this scope (resolved 1,2,3,12 of §7). |
| 003 | API contract & error handling | next | Normalize error responses and ordering (points 4,5,6 of §7 of spec 001) and address new findings from spec 002: `"Player not found"` and the `secret`-null check return `200` with `{ error }` (and handling in the frontend of `400`/`404`). Make the API contract consistent with proper HTTP semantics. | backend, frontend | 002 | Should `GET /api/game/:id` stop returning `{ error: ... }` with 200 (point 4)? Should error middleware ordering/handler style be standardized (points 5,6)? How should frontend map 400/404/error bodies (currently renders empty on `{error}` per plan §5)? Should `Player not found`/secret-null cases be 404/400/409 or a new contract? |
| 004 | Cleanup | planned | Address unused scaffold and housekeeping: points 7, 10, 11 of §7 (NestJS files not used by Express entrypoint, seed typos `Pittsburg Steelers`/`Tampa Bay Buccanners`/`Tennesse Titans`, README/env filename mismatch `frontend/.env.local` vs `frontend/.env`). **new**: decide whether to truly migrate to NestJS or remove the scaffold. | backend, frontend | 002 | Migrate to NestJS (and align entrypoints/tests) or delete unused Nest files/deps (`src/main.ts`, `src/app.module.ts`, `src/prisma/*`, `test/app.e2e-spec.ts`, `nest-cli.json`)? Fix seed typos without affecting existing data assumptions? Align README/env docs. |
| 005 | Daily mode in the frontend | planned | Expose daily/leaderboard functionality in the UI (point 8). Backend already has `GET /api/game/daily/today` and `GET /api/game/leaderboard/top`. | frontend, backend | 002 | What UI/UX for daily mode (separate flow vs main game)? Should daily reuse the same game rules/contract from spec 002? Caching/refresh behavior? |
| 006 | Sessions, timestamps and streaks | planned | Add timestamps, session ownership/identity, and expiration/streaks (point 9). Anonymous sessions today have no timestamps/ownership/expiry. | backend, frontend | 005 | Identity/auth model (anonymous IDs vs accounts)? Expiration policy? Streak definition (daily vs rolling)? Schema/migration implications and backwards compatibility with existing sessions? |
| 007 | Frontend design improvements | planned | UX polish (screens, loading/error/empty states, responsive, accessibility). Scope to be defined in its own spec. | frontend | 002 | What states need coverage given new API behavior (early win reveal, finished state)? Accessibility requirements? Design system constraints? Prioritization vs 003/005? |

## Mapping of known inconsistencies

| Spec 001 §7 point | Issue | Spec that resolves it |
|---|---|---|
| 1 | `Guess.result` stores a boolean | 002 (RF-1) — persists hint object; legacy booleans left as-is/ignored |
| 2 | `isFinished`/`secretPlayer` guess-count based | 002 (RF-2) — derived from persisted `isFinished`, revealed on game end |
| 3 | No guard against guessing after game ends | 002 (RF-3) — finished sessions rejected with `Game already finished` (400) |
| 4 | `GET /api/game/:id` hides failures in body (200 with `{ error }`) | **003** (next) — API contract & error handling |
| 5 | Error middleware registered after `app.listen` | **003** (next) — API contract & error handling |
| 6 | Route handler return/style inconsistency | **003** (next) — API contract & error handling |
| 7 | Unused Nest scaffold + e2e test expecting `Hello World!` | **004** (planned) — cleanup |
| 8 | Daily/leaderboard backend-only | **005** (planned) — frontend integration |
| 9 | No timestamps/ownership/expiration | **006** (planned, depends on 005) — sessions/timestamps/streaks |
| 10 | Seed data typos (`Pittsburg Steelers`, `Tampa Bay Buccanners`, `Tennesse Titans`) | **004** (planned) — cleanup |
| 11 | Env filename mismatch in docs (`frontend/.env.local` vs `frontend/.env`) | **004** (planned) — cleanup |
| 12 | `attempts` may lag on losses / not increment per guess | 002 (RF-4/RF-5) — atomic increment per accepted guess |

## Open questions across specs

- **003 contract**: Normalize 200-with-`{error}` cases (`"Player not found"`, `"Game not found"` on some paths, secret-null → 200 `{error:"Game not found"}`) to proper HTTP codes? Should validation precedence be enforced and documented? How must frontend handle 400/404 without rendering empty?
- **002 follow-ups (new)**: `"Player not found"` returns 200 with `{error}` and the `secret` lookup null is treated defensively as 200 `{error:"Game not found"}` — both marked candidates for 003.
- **004 scope**: Migrate to NestJS or remove scaffold? If removed, update deps/tests/docs; if migrated, ensure Express entrypoint is not reintroduced as source of truth (must respect constitution §2).
- **005/006**: Daily/leaderboard UX, identity/auth for sessions/streaks, migration/backcompat, expiration.
- **007**: Scope/prioritization relative to contract fixes (003) before heavy UI redesign.

## Summary
- **Created:** `specs/roadmap.md` (English, scannable). No other files modified.
- **Entries:** 001 done, 002 done (integrity/atomicity/hints/session-derived state + reconciliation), 003 next (error contract + frontend handling), 004 planned (cleanup/scaffold/typos/docs + Nest decision), 005 planned (daily/leaderboard UI), 006 planned (timestamps/identity/streaks, depends on 005), 007 planned (design/UX).
- **Mapping:** §7 points 1-3,12 resolved by 002; 4-6,9? 4-6 → 003, 7,10,11 → 004, 8 → 005, 9 → 006. **Discrepancy noted:** the requested text listed “Covers the points 4,5 and 6…” for 003 but §7 also has 4-6 grouped; 003 is set to cover 4,5,6 as requested. Added spec-002 new findings to 003. No other contradictions found that required ignoring the requested structure.
- **Notes:** Order/dependencies adjusted only as necessary (006 depends on 005). All entries trace to 001/002; new items marked “new”.

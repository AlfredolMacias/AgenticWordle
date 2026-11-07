# Tasks — 003 API Contract & Error Handling

## Phase 0 — Setup
**T-00** Create branch `003-contrato-api-manejo-errores`

## Phase 1 — Backend fixes

**T-01** Fix middleware order in `backend/src/server.ts` - move `errorHandler` before `app.listen()`
**T-02** Update `backend/src/middleware/error.middleware.ts` - add `"Player not found"` → 404
**T-03** Update `backend/src/services/game.service.ts` - change `getGameService` to throw on not found; change `makeGuessService` to throw for player not found and secret not found
**T-04** Update `backend/src/controllers/game.controller.ts` - use try/catch with `next(err)` or wrap with asyncHandler for consistency
**T-05** Add/update tests for error status codes

## Phase 2 — Frontend fixes

**T-06** Update `frontend/app/game/page.tsx` to handle error responses properly

## Phase 3 — Verification
**T-07** Run tests, lint, build
**T-08** Update docs (AGENTS.md files if needed)

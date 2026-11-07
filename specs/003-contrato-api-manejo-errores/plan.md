# Plan — 003 API Contract & Error Handling

Derived from `specs/003-contrato-api-manejo-errores/spec.md`.

## 1. Approach summary

Make services throw errors (or return in a way consistent with middleware) so Express error middleware handles them. Fix middleware registration order. Update controllers to pass errors to `next(err)`. Update frontend to handle error status codes properly.

## 2. Backend changes

### `backend/src/server.ts`
- Move `app.use(errorHandler)` to be registered **after** all routes and middleware (currently after `app.listen` which is wrong - error handler must be registered before listen, after routes). Actually in Express, error handlers are middleware with 4 args; they must be defined last. Currently line 37 is after `app.listen()` - that's wrong order. Move it before listen or just ensure it's last. Better: register all routes/middleware, then error handler, then listen.

### `backend/src/services/game.service.ts`
- `getGameService`: if not found, throw `new Error('Game not found')` (or keep returning but controller needs to handle; better throw so middleware maps to 404).
- `makeGuessService`: if `guessedPlayer` not found → throw `new Error('Player not found')` (middleware currently doesn't map it; need to add mapping to 404).
- `makeGuessService`: if `secret` not found → throw `new Error('Game not found')` (already mapped to 404).
- Also in transaction, if `current` not found throw.

### `backend/src/middleware/error.middleware.ts`
- Add mapping for `"Player not found"` → 404.
- Keep existing mappings.

### `backend/src/controllers/game.controller.ts`
- Use `asyncHandler` or try/catch and pass to `next(err)`. Or just let errors throw if using asyncHandler wrapper. Check if `asyncHandler` exists and is used.
- Update to be consistent.

### `backend/src/utils/asyncHandler.ts` (if exists)
- Use it to wrap async handlers.

## 3. Frontend changes

### `frontend/app/game/page.tsx`
- Check response status; if not ok, parse error and display it.
- Handle 400/404 appropriately.

## 4. Testing
- Add tests for error cases with correct status codes.
- Update existing tests if they expect old behavior.

## 5. Execution order
1. Fix server.ts middleware order
2. Update error middleware
3. Update services to throw errors
4. Update controllers
5. Update frontend
6. Test and verify

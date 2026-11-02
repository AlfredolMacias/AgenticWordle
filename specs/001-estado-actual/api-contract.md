# API Contract

Contract for the NFL Wordle backend as implemented today.

## Global

- **Base URL**: the Express server host (dev default `http://localhost:3000`).
- **Prefix**: all routes are served under `/api`.
- **Content type**: `application/json` for request and response bodies.
- **Frontend access**: via `NEXT_PUBLIC_API_URL` (e.g. `POST {NEXT_PUBLIC_API_URL}/api/game/start`).

### Cross-cutting middleware

- **CORS**: allowlist `http://localhost:3001` and `https://findfootballplayer.vercel.app`, `credentials: true`.
- **Helmet**: default security headers.
- **Rate limit**: 100 requests per 15 minutes; over the limit returns `"Too many requests, try again later"`.
- **Validation**: request bodies parsed with Zod (`guessSchema`) at the controller boundary.

### Shared enums & tables

**Hint values** (`result.*`): `"correct" | "incorrect" | "higher" | "lower"`.

**Score table** (indexed by attempt number): `[100, 80, 60, 40, 20, 10, 0]`.

### Error responses

- **400 Zod validation**:
  ```json
  { "error": "Validation error", "details": "..." }
  ```
- **404 `Game not found`** (only when `"Game not found"` is thrown as an `Error`): `{ "error": "Game not found" }`
- **400 `Game already finished`** (defined in the handler but not currently thrown by the service): `{ "error": "Game already finished" }`
- **500**: `{ "error": "Internal Server Error" }`

> Note: several service functions return an `{ "error": "..." }` object with HTTP 200 instead of throwing. See the specific endpoint notes below.

---

## Game endpoints

### `POST /api/game/start`

Starts a new game with a randomly selected secret player.

- **Request body**: none.
- **200 response**: the created `GameSession`:
  ```json
  {
    "id": 1,
    "secretPlayerId": 123,
    "attempts": 0,
    "isFinished": false,
    "isWin": false,
    "score": null
  }
  ```

### `POST /api/game/:id/guess`

Submits a guess for a game session.

- **Path param**: `id` — game session id.
- **Request body** (Zod `guessSchema`):
  ```json
  { "playerId": 123 }
  ```
  `playerId` must be a positive integer; otherwise → 400 validation error.
- **200 response**:
  ```json
  {
    "player": "string",
    "position": "string",
    "jersey": 0,
    "team": "string",
    "conference": "string",
    "division": "string",
    "result": {
      "team": "correct | incorrect",
      "position": "correct | incorrect",
      "jersey": "correct | higher | lower",
      "conference": "correct | incorrect",
      "division": "correct | incorrect"
    },
    "isWinner": false,
    "score": 0,
    "isFinished": false,
    "secretPlayer": ""
  }
  ```
  `secretPlayer` is populated only on the final (6th) guess.
- **200 response when max guesses reached** (before creating a 7th):
  ```json
  { "message": "Maximum number of guesses reached", "error": true }
  ```
- **200 response when game not found**:
  ```json
  { "error": "Game not found" }
  ```
- **200 response when player not found**:
  ```json
  { "error": "Player not found" }
  ```

Game rules: a win requires team + position + jersey all `"correct"`. Max 6 guesses; the secret is revealed only when the game ends.

### `GET /api/game/:id`

- **Path param**: `id` — game session id.
- **200 response**: the `GameSession` record.
- **200 response when not found** (returns 200, not 404):
  ```json
  { "error": "Game not found" }
  ```

### `GET /api/game/daily/today`

Returns today's daily game, creating it if it does not exist.

- **200 response**:
  ```json
  { "dailyGameId": 1 }
  ```

### `GET /api/game/leaderboard/top`

Returns the top 10 finished games ordered by score descending.

- **200 response**: array of `GameSession` records where `isFinished: true` and `score` is not null.

---

## Player endpoints

### `GET /api/players`

Returns all players.

- **200 response**: array of `Player` records.
- **500**: `{ "error": "Error fetching players" }`

### `GET /api/players/random`

Returns one random player.

- **200 response**: a `Player` record.
- **500**: `{ "error": "Error selecting player" }`

### `GET /api/players/search`

Case-insensitive name search for autocomplete.

- **Query param**: `q` — search string. Missing/empty returns `[]`.
- **200 response**: up to 10 matches:
  ```json
  [
    { "id": 1, "name": "string", "position": "string", "team": { "name": "string" } }
  ]
  ```

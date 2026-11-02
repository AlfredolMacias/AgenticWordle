# NFL Wordle

Fullstack Wordle-style game: guess an NFL player from clues (team, position, jersey, conference, division).

- `backend/` — Express + Prisma/PostgreSQL API (see `backend/AGENTS.md`)
- `frontend/` — Next.js 16 (App Router) + React 19 + Tailwind 4 (see `frontend/AGENTS.md`)

## Commands

Run from the relevant subdirectory.

Backend (`backend/`):
- Dev: `npm run dev` (nodemon on `src/server.ts`)
- Build: `npm run build` (prisma generate + tsc)
- Test: `npx jest` (single Jest config; `src/test/game.test.ts` hits a live DB)
- Lint: `npm run lint` · Format: `npm run format`
- Migrate: `npx prisma migrate dev` · Seed: `npx prisma db seed`

Frontend (`frontend/`):
- Dev: `npm run dev` · Build: `npm run build` · Lint: `npm run lint`

## Cross-cutting rules

- Do NOT commit `.env` files or secrets. `DATABASE_URL` (backend) and `NEXT_PUBLIC_API_URL` (frontend) are required.
- API base path is `/api`; the frontend talks to it via `NEXT_PUBLIC_API_URL`.
- Keep changes scoped to one side of the stack unless a contract change requires both.

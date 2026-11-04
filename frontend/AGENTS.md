<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend — NFL Wordle

Next.js 16 App Router + React 19 + Tailwind 4. TypeScript. No test suite.

## Commands

- Dev: `npm run dev` · Build: `npm run build` · Lint: `npm run lint`

## Structure

- `app/page.tsx` — landing page with "Start Game" link to `/game`.
- `app/game/page.tsx` — client game board; starts a game and submits guesses.
- `app/components/PlayerInput.tsx` — debounced autocomplete search with ↑/↓/Enter keyboard nav.
- `app/components/GuessRow.tsx` — renders one guess with per-attribute colors.
- `app/layout.tsx` — root layout (Geist fonts, `app/globals.css`).

## Conventions

- API calls use `${process.env.NEXT_PUBLIC_API_URL}/api/...`; `NEXT_PUBLIC_API_URL` is required (`.env`).
- Interactive components are Client Components (`"use client"`); pages are fetch-driven.
- Game hint values are `"correct" | "incorrect" | "higher" | "lower"`; `GuessRow` maps these to colors.


# Munshee.pk
Pakistan's first Business OS.

Phase 1.1 — Foundation.

## Status

- Foundation scaffolding: **real, in place.**
- Supabase client wiring: **real, but runtime-untested-pending-keys.** Auth will not work until you supply a real Supabase project URL + anon key and run the migration.
- No mocked auth, no stubbed Supabase, no Gemini, no AI/LLM, no scraping, no HITL, no catalog/orders/inventory/CSV. Those belong to later phases.

## Stack

- React 19, TypeScript (strict), Vite 5, React Router 7 (library mode), Tailwind 3.4, TanStack Query v5, Supabase JS v2, Cloudflare Pages (via `@cloudflare/vite-plugin`).

## Setup

1. Create a Supabase project at https://supabase.com
2. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_REDIRECT_URL` (default `http://localhost:5173/auth/callback` for local dev)
3. Open the Supabase SQL Editor for your project and run `supabase/migrations/0001_init.sql` in full.
4. Install and run:
   ```bash
   pnpm install
   pnpm dev
   ```
5. Open http://localhost:5173

## Deploy (Cloudflare Pages)

- Build command: `pnpm build` (or `pnpm cf:build`)
- Output directory: `dist`
- Pages project name: `munshee-pk`
- Add the same env vars in the Pages dashboard.

## Scripts

- `pnpm dev` — local dev server
- `pnpm build` — typecheck + production build
- `pnpm cf:build` — production build (CF Pages)
- `pnpm preview` — preview production build
- `pnpm typecheck` — type-check only
- `pnpm lint` — eslint

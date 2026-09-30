# store-health

Monitors Shopify storefronts for agencies: crawls each store on a schedule, finds broken links, slow pages and front-end errors, and emails only about new problems. Product decisions live in `docs/spec.md`; architecture decisions in `docs/adr/`. Read both before proposing structural changes.

## Layout
- `apps/web`: Next.js (App Router), frontend only. Never talks to the database; calls the API. Has its own `AGENTS.md` with Next.js-version notes; follow it when editing that app.
- `apps/api`: Hono on Node. All business logic, validation and auth live here. `src/app.ts` builds the app (imported by tests); `src/server.ts` only starts it.
- `packages/shared`: zod schemas and pure functions used by web, API and (later) the worker. No I/O here.

## Commands (run from the repo root)
- install: `pnpm install`
- dev (web on :4000, API on :4001): `pnpm dev`
- test: `pnpm test`
- typecheck: `pnpm typecheck`
- lint: `pnpm lint` (auto-fix: `pnpm format`)

Before calling a task done, run `pnpm lint && pnpm typecheck && pnpm test` and report the result.

## Conventions
- TypeScript strict everywhere. No `any`; use `unknown` and narrow.
- Validate every external input (request bodies, params, query strings, env vars, crawled content) with zod at the boundary.
- In `apps/api` and `packages/shared`, relative imports use the real `.ts` extension: `import { createApp } from "./app.ts"`. Don't use `.js`: Next.js (Turbopack) can't resolve `.js` to `.ts` inside `packages/shared`, so the web app fails to build even though API tests pass.
- API route tests call `app.request(...)` directly; no running server needed.
- Tests live next to the code as `*.test.ts`.
- Write or update tests first when changing behavior; stop and show them before implementing if asked.

## Security rules (non-negotiable)
- The crawler fetches user-supplied URLs. Every outbound fetch goes through the shared URL validation and, from Phase 2, SSRF protection (DNS resolution + private-range blocking, re-checked on each redirect).
- Never build shell commands from strings. If a child process is ever needed, use `spawn` with an args array.
- Secrets only via environment variables; never commit `.env` files. Store credentials encrypted at rest.

## Never
- Weaken, skip or delete a test to make it pass.
- Add a dependency without saying why in the PR/summary; prefer what's already installed.
- Put business logic or database access in `apps/web`.
- Approve a package's install scripts (`allowBuilds` in `pnpm-workspace.yaml`) without explaining why it needs them.

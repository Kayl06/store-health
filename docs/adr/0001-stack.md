# ADR 0001: Core stack

**Status:** Accepted
**Date:** 2026-09-30

## Context

store-health is a multi-tenant web app for agencies (see `docs/spec.md`). It needs a dashboard, an HTTP API, a background crawler, Postgres, and authentication with organizations. It is also a learning project: the stack should keep backend fundamentals visible rather than hidden behind a framework, and be common enough in the job market to count on a resume.

## Decision

| Concern | Choice |
|---|---|
| Language | TypeScript everywhere, `strict` mode |
| Runtime | Node.js 24 LTS (target for deployment; newer local versions are fine) |
| Repo | pnpm workspaces monorepo: `apps/web`, `apps/api`, `packages/shared` (`apps/worker` added in Phase 1) |
| Frontend | Next.js (App Router), used as the **frontend only** |
| API | Hono on Node, as a separate service |
| Validation | zod schemas in `packages/shared`, used by web, API and worker |
| Database | Postgres hosted on Supabase, accessed with Drizzle ORM and Drizzle migrations |
| Auth | Better Auth running inside the API, with its organization plugin |
| Tests | Vitest everywhere; Supertest-style request tests against the Hono app |
| Lint / format | Biome |

## Why

- **Separate API instead of Next.js route handlers.** Keeps HTTP design, validation, auth and error handling explicit and testable in one place. The crawler worker and a future Shopify webhook receiver talk to the same backend.
- **Next.js as frontend only.** The most requested React framework in job posts. Business logic stays in the API so there is one source of truth; Next.js server components may *call* the API but don't talk to the database.
- **Hono.** Small, built on the standard `Request`/`Response` web APIs (skills transfer to any runtime), first-class zod validation, fast to test without starting a server.
- **Better Auth inside the API.** Sessions, cookies and auth tables live in our own database and code, so authentication and organization membership can be understood and tested properly instead of treated as a black box.
- **Supabase for Postgres.** Managed Postgres with a good dashboard and an MCP server for inspecting the schema. We use it as a database host only, not its auth or client SDK, so we could move to any Postgres.
- **Drizzle.** SQL-shaped queries and plain SQL migrations that are easy to review line by line.

## Rejected

- **Vite + React SPA:** already familiar; less career value than Next.js.
- **Fastify:** a good option, but Hono's web-standard APIs and zod integration fit a TypeScript-first monorepo better.
- **Next.js route handlers as the backend:** mixes backend into the frontend and makes the worker and webhooks awkward.
- **Supabase Auth:** faster to set up, but hides the parts of auth this project is meant to teach, and ties user management to one vendor.
- **Prisma:** heavier abstraction and generated client; Drizzle migrations are easier to review.

## Consequences

- Two deployable services from the start (web and API), plus a worker later. CORS and cookie settings must be configured deliberately for the web → API calls.
- We own auth security: session handling, CSRF protection and password reset flows must be tested.
- Row-level security (Phase 2) needs the API to set the current organization on each database connection, since we aren't using Supabase Auth.

## Deferred

These are decided when the phase that needs them starts, each with its own ADR:
- Job queue (planned: pg-boss), Phase 3
- Hosting for API and worker, Phase 3
- Browser automation and Lighthouse setup, Phase 3
- Email provider, Phase 3
- Observability tooling, Phase 4
- LLM provider, Phase 5

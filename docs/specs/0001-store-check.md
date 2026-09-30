# Spec 0001: Store check (walking skeleton)

**Status:** Accepted (Sep 30, 2026). Decisions by Kayl: store failures are 200 results, web reaches API via Next.js rewrites, password pages are reported only, every redirect is re-validated.
**Phase:** 0, week 1

## Why

Prove the whole path works end to end (browser → web → API → shared validator → a real Shopify storefront → back to the screen) before building anything on top of it. Every later feature (crawling, checks, alerts) reuses this path.

## Observed facts (Sep 30, against the dev store)

- `GET https://store-health-deb-store.myshopify.com/` returns `302` with `location: /password`, then `/password` returns `200`. About 0.6 s total.
- Every Shopify response carries a `powered-by: Shopify` header.

## API contract

`POST /store-checks` on the API (the browser reaches it as `/api/store-checks`, see "Web → API").

**Request body**

```json
{ "url": "store-health-deb-store.myshopify.com" }
```

**200 OK**: the check ran. The store being down or broken is a *result*, not an API error.

```json
{
  "origin": "https://store-health-deb-store.myshopify.com",
  "outcome": "password_protected",
  "statusCode": 200,
  "finalUrl": "https://store-health-deb-store.myshopify.com/password",
  "redirects": [
    {
      "from": "https://store-health-deb-store.myshopify.com/",
      "to": "https://store-health-deb-store.myshopify.com/password",
      "statusCode": 302
    }
  ],
  "isShopify": true,
  "responseTimeMs": 594,
  "checkedAt": "2026-09-30T10:30:00.000Z"
}
```

`outcome` is one of:

| outcome | When | `statusCode` |
|---|---|---|
| `ok` | Final response is 2xx and not the password page | final status |
| `password_protected` | Redirect chain ends at `/password` on the store's origin | final status |
| `http_error` | Final response is 4xx or 5xx | final status |
| `blocked_redirect` | A redirect points somewhere `parseStoreUrl` rejects (http, IP, localhost, port...) | the redirect's status |
| `too_many_redirects` | More than 5 redirects | last status |
| `timeout` | No final response within 10 s | `null` |
| `unreachable` | DNS failure, connection refused, TLS error | `null` |

**400 Bad Request**: the input is wrong. Body shape:

```json
{ "error": { "code": "invalid_url", "message": "Only https:// store URLs are supported." } }
```

- `invalid_url`: `parseStoreUrl` rejected it; `message` is its `reason`.
- `invalid_request`: body isn't JSON, or `url` is missing or not a string.

Request and response shapes are zod schemas in `packages/shared` so web and API can't drift apart.

## Behavior

- **Validation:** the API runs `parseStoreUrl` on the input and checks `/` on the returned origin. The web app runs the same function before submitting for instant feedback, but the API is the source of truth.
- **Redirects:** followed manually (`redirect: "manual"`), up to 5. Each hop is recorded. **Every redirect target must pass `parseStoreUrl` before it's requested**; otherwise stop with `blocked_redirect` and don't request it. Relative `location` headers are resolved against the current URL.
- **Password page:** reported only (`password_protected`). No login attempt in this step.
- **Timeout:** 10 s for the whole check, including redirects.
- **Response time:** milliseconds from sending the first request to receiving the final response's headers, including redirects. The body is not downloaded (cancel it once headers arrive).
- **Shopify detection:** `isShopify` is true if any response had `powered-by: Shopify`.
- **Politeness:** method `GET`; header `User-Agent: store-health/0.1 (+https://github.com/Kayl06/store-health)`.

## Web → API

Next.js rewrites `/api/:path*` to the API (`API_URL` env var, default `http://localhost:4001`). The browser only ever talks to its own origin, so no CORS setup is needed now, and auth cookies will work the same way in Phase 2.

## UI (`apps/web`, home page)

- A URL input and a "Check store" button.
- While checking: button disabled and reads "Checking…".
- Invalid input: the reason appears under the input (from the shared validator, or the API's `message`).
- Result: the outcome as a short label ("Online", "Password protected", "HTTP error", ...), status code, response time, final URL, the redirect chain, and whether it's a Shopify store.
- Plain Tailwind, no component library.

## Non-goals (don't build these yet)

- Saving checks or any database
- Auth, users, organizations
- Logging in to password-protected stores
- Fetching any page other than `/`, or parsing the HTML body
- Retries, rate limiting, queueing
- DNS-based SSRF protection (tracked as a todo test; Phase 2)
- Web component tests (Phase 1) or any UI library

## Design constraint for testability

The checker receives `fetch` as a parameter (`createApp({ fetch })` in `apps/api/src/app.ts`; `server.ts` passes the real `globalThis.fetch`). Tests pass a fake, so they never touch the network.

## Acceptance tests (written first, API-level, via `app.request`)

1. Invalid URL (`http://my-store.com`) → 400 `invalid_url`, message mentions https.
2. Missing `url`, non-string `url`, or non-JSON body → 400 `invalid_request`.
3. Store returns 200 with `powered-by: Shopify` → `ok`, `statusCode` 200, no redirects, `isShopify: true`, `responseTimeMs` ≥ 0.
4. `/` → 302 `/password` → 200 → `password_protected`, one redirect recorded with from/to/status.
5. Final 404 or 503 → `http_error` with that status.
6. Redirect to `http://...` or `https://127.0.0.1/` → `blocked_redirect`, and the fake fetch was never called with that URL.
7. Six redirects in a row → `too_many_redirects`.
8. Fetch never settles → `timeout` (use a short timeout injected for the test, not a real 10 s wait).
9. Fetch throws a network error → `unreachable`.
10. Every request uses `redirect: "manual"`, method GET and the store-health `User-Agent`.
11. Relative redirect (`location: /password`) is resolved against the current URL.

## Manual verification

Run `pnpm dev`, open http://localhost:4000, check `store-health-deb-store.myshopify.com` → "Password protected", 1 redirect, Shopify: yes. Check `oddpieces.com` → "Online". Check `http://oddpieces.com` → inline https error.

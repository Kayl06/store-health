# store-health: product spec

**Status:** v1, agreed Sep 30, 2026
**Owner:** Kayl Rabanzo

## Problem

Agencies and freelancers who look after several Shopify stores find out about broken pages, slow product pages and failing app embeds from the client, usually after it has cost sales. Checking every store by hand doesn't scale, and generic uptime monitors only tell you the homepage returns 200.

## Who it's for

**Primary: the agency developer or owner** managing 3–30 client stores. They want one dashboard for all stores, and to hear only about *new* problems.

**Not yet: the merchant.** Client-facing access (read-only reports, white-label) comes after the first release.

## Core concepts

| Term | Meaning |
|---|---|
| Organization | An agency account. Owns stores. Has members. |
| Member | A user in an organization. |
| Store | A Shopify storefront being monitored (its domain plus settings). |
| Crawl | One run over a store's pages at a point in time. |
| Page | A URL visited during a crawl, with status code, timing and size. |
| Issue | A specific problem found on a page (e.g. "broken link to /products/old-hat"). Each issue has a stable **fingerprint** so the same problem in two crawls is recognized as the same issue. |
| Alert | A notification sent when a crawl finds issues that weren't in the previous crawl. |

## User stories (first release)

1. **Add a store.** As an agency dev, I add a client's store by domain so it starts being monitored.
   - Accepts `https://` storefront domains only; rejects IP addresses, localhost and credentials in the URL.
   - Shows a first result within a few minutes.
2. **See what's broken.** As an agency dev, I open a store and see its current issues grouped by type and severity, with the page they're on.
   - Each issue links to the page and says what's wrong in plain language.
3. **Hear about new problems only.** As an agency dev, I get an email when a scheduled crawl finds issues that weren't there last time, and not for issues I already know about.
   - Resolved issues are marked resolved automatically.
4. **See all my stores at once.** As an agency owner, I see every store's health on one screen and can tell which needs attention first.
5. **Keep clients separate.** As an agency owner, my team can only see our organization's stores, never another agency's.

## Checks

| Tier | Check | How | Lands in |
|---|---|---|---|
| A: HTML | Broken links, 404s, redirect loops | Fetch pages from the sitemap, follow links, record status codes | Phase 1 |
| A: HTML | Broken or oversized images | Parse `<img>` tags, check status and byte size | Phase 1–2 |
| A: HTML | SEO basics | Missing or duplicate `<title>`, meta description, image `alt` text | Phase 1–2 |
| B: Browser | JavaScript console errors, failing app embeds | Headless browser (Playwright) on key pages | Phase 3 |
| B: Browser | Page speed / Core Web Vitals | Lighthouse on key pages (home, one collection, one product, cart) | Phase 3 |

## First-release scope (target: week 13)

**In:** organizations and members, adding stores by domain, scheduled crawls (daily by default), all five checks above, a dashboard across stores, email alerts for new issues, Shopify app install to trigger a crawl when a theme is published.

**Out (for now):**
- Slack alerts (email only in the first release)
- Billing and plans (free for Kayl's clients first; revisit after week 21)
- Client-facing or white-label reports
- Auto-fixing anything
- Non-Shopify sites (the crawler may work on them, but it isn't designed or tested for them)
- The AI "what changed and why" feature (Phase 5, after the first release)

## Constraints

- **Politeness:** respect `robots.txt`, identify the crawler with a clear user agent, cap concurrency per store (start at 4) and pages per crawl (start at 500).
- **Security:** the crawler fetches user-supplied URLs, so SSRF protection is required (https only, resolve DNS and block private and metadata IP ranges, re-check on every redirect). Store credentials encrypted at rest. Never build shell commands from strings.
- **Data:** only public storefront content is read; no customer or order data.

## Success measures

- Crawling a 500-page store finishes in under 5 minutes.
- Alerts contain only new issues. Target: zero repeat alerts for a known issue.
- 3 real client stores connected by week 21.

## Decisions

1. **Password-protected storefronts are supported.** When adding a store, the agency can enter the storefront password. The crawler submits it to the store's `/password` form, keeps the session cookie for the rest of the crawl, and re-authenticates if the session expires. The password is encrypted at rest and never shown again after saving. If a store is protected and no password (or a wrong one) is set, the crawl stops with a clear "password protected" status instead of reporting every page as broken.
2. **Key pages are a fixed set for now:** home, one collection, one product, cart (the first collection and product found in the sitemap). Choosing key pages per store comes after the first release.
3. **Severity has three levels:**
   - **Critical:** breaks shopping or makes content unreachable, e.g. a 404 or 5xx on a product, collection or cart page, a redirect loop, JavaScript errors on the cart or product page.
   - **Warning:** hurts conversion or quality, e.g. a broken link on a non-commerce page, a key page slower than its Core Web Vitals threshold, a broken image, an oversized image.
   - **Info:** worth fixing when convenient, e.g. missing alt text, missing or duplicate meta description.
   Only critical and warning issues trigger alerts.
4. **Crawl frequency:** daily by default, plus a "crawl now" button. No hourly schedule in the first release.

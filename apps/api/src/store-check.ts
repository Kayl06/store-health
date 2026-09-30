import {
  parseStoreUrl,
  type StoreCheckOutcome,
  type StoreCheckRedirect,
  type StoreCheckResult,
} from "@store-health/shared";

export type Fetch = typeof globalThis.fetch;

export const USER_AGENT = "store-health/0.1 (+https://github.com/Kayl06/store-health)";

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface CheckStoreOptions {
  fetch: Fetch;
  timeoutMs: number;
}

/** Fetches a store's homepage, following and re-validating redirects. `origin` must come from `parseStoreUrl`. */
export async function checkStore(
  origin: string,
  { fetch, timeoutMs }: CheckStoreOptions,
): Promise<StoreCheckResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = performance.now();
  const signal = AbortSignal.timeout(timeoutMs);
  const redirects: StoreCheckRedirect[] = [];
  let currentUrl = `${origin}/`;
  let isShopify = false;

  const finish = (outcome: StoreCheckOutcome, statusCode: number | null): StoreCheckResult => ({
    origin,
    outcome,
    statusCode,
    finalUrl: currentUrl,
    redirects,
    isShopify,
    responseTimeMs: Math.round(performance.now() - startedAt),
    checkedAt,
  });

  for (;;) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: { "user-agent": USER_AGENT },
        signal,
      });
    } catch {
      return finish(signal.aborted ? "timeout" : "unreachable", null);
    }

    await response.body?.cancel();

    if (response.headers.get("powered-by")?.toLowerCase() === "shopify") {
      isShopify = true;
    }

    const location = response.headers.get("location");
    if (REDIRECT_STATUSES.has(response.status) && location !== null) {
      if (redirects.length === MAX_REDIRECTS) {
        return finish("too_many_redirects", response.status);
      }

      let target: URL;
      try {
        target = new URL(location, currentUrl);
      } catch {
        return finish("blocked_redirect", response.status);
      }

      if (!parseStoreUrl(target.href).ok) {
        return finish("blocked_redirect", response.status);
      }

      redirects.push({ from: currentUrl, to: target.href, statusCode: response.status });
      currentUrl = target.href;
      continue;
    }

    if (response.status >= 200 && response.status < 300) {
      const final = new URL(currentUrl);
      const isPasswordPage = final.origin === origin && final.pathname === "/password";
      return finish(isPasswordPage ? "password_protected" : "ok", response.status);
    }

    return finish("http_error", response.status);
  }
}

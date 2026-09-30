import {
  apiErrorSchema,
  type StoreCheckResult,
  storeCheckResultSchema,
} from "@store-health/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { type Fetch, USER_AGENT } from "./store-check.ts";

const STORE = "https://my-store.myshopify.com";

type Route = (init: RequestInit | undefined) => Response | Promise<Response>;

function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch: Fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const route = routes[url];
    if (route === undefined) {
      throw new Error(`Unexpected request to ${url}`);
    }
    return route(init);
  };
  return { fetch, calls };
}

function page(status = 200, headers: Record<string, string> = {}): Route {
  return () => new Response(null, { status, headers });
}

function redirect(location: string, status = 302): Route {
  return () => new Response(null, { status, headers: { location } });
}

function post(app: ReturnType<typeof createApp>, body: string) {
  return app.request("/store-checks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

async function checkStore(
  routes: Record<string, Route>,
  url = STORE,
  checkTimeoutMs?: number,
): Promise<{ result: StoreCheckResult; calls: ReturnType<typeof fakeFetch>["calls"] }> {
  const { fetch, calls } = fakeFetch(routes);
  const app = createApp(checkTimeoutMs === undefined ? { fetch } : { fetch, checkTimeoutMs });
  const res = await post(app, JSON.stringify({ url }));
  expect(res.status).toBe(200);
  return { result: storeCheckResultSchema.parse(await res.json()), calls };
}

async function expectApiError(body: string, code: "invalid_url" | "invalid_request") {
  const { fetch, calls } = fakeFetch({});
  const res = await post(createApp({ fetch }), body);
  expect(res.status).toBe(400);
  const error = apiErrorSchema.parse(await res.json());
  expect(error.error.code).toBe(code);
  expect(calls).toHaveLength(0);
  return error.error.message;
}

describe("POST /store-checks", () => {
  describe("input errors", () => {
    it("rejects an invalid store URL with the validator's reason", async () => {
      const message = await expectApiError(
        JSON.stringify({ url: "http://my-store.com" }),
        "invalid_url",
      );
      expect(message).toMatch(/https/i);
    });

    it.each([
      ["a missing url", JSON.stringify({})],
      ["a non-string url", JSON.stringify({ url: 42 })],
      ["a non-JSON body", "not json"],
    ])("rejects %s as an invalid request", async (_label, body) => {
      await expectApiError(body, "invalid_request");
    });
  });

  describe("outcomes", () => {
    it("reports ok for a store that responds 200", async () => {
      const { result } = await checkStore({
        [`${STORE}/`]: page(200, { "powered-by": "Shopify" }),
      });

      expect(result).toMatchObject({
        origin: STORE,
        outcome: "ok",
        statusCode: 200,
        finalUrl: `${STORE}/`,
        redirects: [],
        isShopify: true,
      });
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("reports password_protected when the store redirects to /password", async () => {
      const { result } = await checkStore({
        [`${STORE}/`]: redirect(`${STORE}/password`),
        [`${STORE}/password`]: page(200),
      });

      expect(result).toMatchObject({
        outcome: "password_protected",
        statusCode: 200,
        finalUrl: `${STORE}/password`,
        redirects: [{ from: `${STORE}/`, to: `${STORE}/password`, statusCode: 302 }],
      });
    });

    it("resolves relative redirects against the current URL", async () => {
      const { result } = await checkStore({
        [`${STORE}/`]: redirect("/password"),
        [`${STORE}/password`]: page(200),
      });

      expect(result.outcome).toBe("password_protected");
      expect(result.redirects[0]?.to).toBe(`${STORE}/password`);
    });

    it.each([404, 503])("reports http_error for a final %i", async (status) => {
      const { result } = await checkStore({ [`${STORE}/`]: page(status) });

      expect(result).toMatchObject({ outcome: "http_error", statusCode: status });
    });

    it("reports not Shopify when the header is missing", async () => {
      const { result } = await checkStore({ [`${STORE}/`]: page(200) });

      expect(result.isShopify).toBe(false);
    });
  });

  describe("redirect safety", () => {
    it.each([
      "http://my-store.myshopify.com/",
      "https://127.0.0.1/",
      "https://localhost/admin",
      "https://my-store.myshopify.com:8443/",
    ])("blocks a redirect to %s without requesting it", async (target) => {
      const { result, calls } = await checkStore({ [`${STORE}/`]: redirect(target, 301) });

      expect(result).toMatchObject({ outcome: "blocked_redirect", statusCode: 301 });
      expect(calls.map((call) => call.url)).toEqual([`${STORE}/`]);
    });

    it("stops after 5 redirects", async () => {
      const routes: Record<string, Route> = { [`${STORE}/`]: redirect(`${STORE}/r1`) };
      for (let hop = 1; hop <= 6; hop++) {
        routes[`${STORE}/r${hop}`] = redirect(`${STORE}/r${hop + 1}`);
      }

      const { result, calls } = await checkStore(routes);

      expect(result.outcome).toBe("too_many_redirects");
      expect(result.redirects).toHaveLength(5);
      expect(calls).toHaveLength(6);
    });
  });

  describe("network failures", () => {
    it("reports timeout when the store doesn't respond in time", async () => {
      const hang: Route = (init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        });

      const { result } = await checkStore({ [`${STORE}/`]: hang }, STORE, 20);

      expect(result).toMatchObject({ outcome: "timeout", statusCode: null });
    });

    it("reports unreachable when the request fails", async () => {
      const fail: Route = () => {
        throw new TypeError("fetch failed");
      };

      const { result } = await checkStore({ [`${STORE}/`]: fail });

      expect(result).toMatchObject({ outcome: "unreachable", statusCode: null });
    });
  });

  it("sends a GET with manual redirects and the store-health user agent", async () => {
    const { calls } = await checkStore({
      [`${STORE}/`]: redirect(`${STORE}/password`),
      [`${STORE}/password`]: page(200),
    });

    expect(calls).toHaveLength(2);
    for (const { init } of calls) {
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");
      expect(new Headers(init?.headers).get("user-agent")).toBe(USER_AGENT);
    }
  });
});

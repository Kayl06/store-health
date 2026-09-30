import { type ApiError, parseStoreUrl, storeCheckRequestSchema } from "@store-health/shared";
import { Hono } from "hono";
import { checkStore, type Fetch } from "./store-check.ts";

export interface AppDependencies {
  fetch: Fetch;
  checkTimeoutMs?: number;
}

function apiError(code: ApiError["error"]["code"], message: string): ApiError {
  return { error: { code, message } };
}

export function createApp({ fetch, checkTimeoutMs = 10_000 }: AppDependencies) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/store-checks", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(apiError("invalid_request", "Request body must be JSON."), 400);
    }

    const request = storeCheckRequestSchema.safeParse(body);
    if (!request.success) {
      return c.json(
        apiError("invalid_request", "Provide the store URL as a string in `url`."),
        400,
      );
    }

    const storeUrl = parseStoreUrl(request.data.url);
    if (!storeUrl.ok) {
      return c.json(apiError("invalid_url", storeUrl.reason), 400);
    }

    return c.json(await checkStore(storeUrl.origin, { fetch, timeoutMs: checkTimeoutMs }));
  });

  return app;
}

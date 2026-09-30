import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = createApp({ fetch: globalThis.fetch });
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

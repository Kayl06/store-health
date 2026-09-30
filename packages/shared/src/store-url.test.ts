import { describe, expect, it } from "vitest";
import { parseStoreUrl } from "./store-url.js";

function expectOrigin(input: string, origin: string) {
  expect(parseStoreUrl(input)).toEqual({ ok: true, origin });
}

function expectRejected(input: string) {
  const result = parseStoreUrl(input);
  expect(result.ok).toBe(false);
}

describe("parseStoreUrl", () => {
  describe("accepts and normalizes storefront URLs", () => {
    it("accepts a plain https URL", () => {
      expectOrigin("https://my-store.myshopify.com", "https://my-store.myshopify.com");
    });

    it("assumes https when no scheme is given", () => {
      expectOrigin("my-store.com", "https://my-store.com");
    });

    it("trims surrounding whitespace", () => {
      expectOrigin("  https://my-store.com  ", "https://my-store.com");
    });

    it("reduces the URL to its origin", () => {
      expectOrigin("https://My-Store.com/products/hat?variant=1#reviews", "https://my-store.com");
    });

    it("accepts an uppercase scheme", () => {
      expectOrigin("HTTPS://my-store.com", "https://my-store.com");
    });

    it("drops a trailing dot on the hostname", () => {
      expectOrigin("https://my-store.com.", "https://my-store.com");
    });

    it("accepts the explicit default port", () => {
      expectOrigin("https://my-store.com:443", "https://my-store.com");
    });

    it("converts internationalized domains to punycode", () => {
      expectOrigin("https://bücher.example", "https://xn--bcher-kva.example");
    });
  });

  describe("rejects empty or unparseable input", () => {
    it.each(["", "   ", "https://", "https://exa mple.com", "https://my-store..com"])(
      "rejects %j",
      (input) => expectRejected(input),
    );
  });

  describe("rejects non-https schemes", () => {
    it.each([
      "http://my-store.com",
      "ftp://my-store.com",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
    ])("rejects %j", (input) => expectRejected(input));
  });

  describe("rejects credentials in the URL", () => {
    it.each(["https://admin:secret@my-store.com", "https://admin@my-store.com"])(
      "rejects %j",
      (input) => expectRejected(input),
    );
  });

  describe("rejects IP addresses in any notation", () => {
    it.each([
      "https://192.168.1.10",
      "https://127.0.0.1",
      "https://169.254.169.254",
      "https://[::1]",
      "https://[fd00::1]",
      "https://2130706433",
      "https://0x7f.0.0.1",
      "https://0177.0.0.1",
    ])("rejects %j", (input) => expectRejected(input));
  });

  describe("rejects local and single-label hostnames", () => {
    it.each([
      "https://localhost",
      "https://localhost.",
      "https://api.localhost",
      "https://intranet",
    ])("rejects %j", (input) => expectRejected(input));
  });

  describe("rejects non-default ports", () => {
    it.each(["https://my-store.com:8443", "https://my-store.com:22"])("rejects %j", (input) =>
      expectRejected(input),
    );
  });

  it("explains why an input was rejected", () => {
    const result = parseStoreUrl("http://my-store.com");
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/https/i) });
  });
});

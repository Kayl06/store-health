export type StoreUrlResult = { ok: true; origin: string } | { ok: false; reason: string };

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const MAX_HOSTNAME_LENGTH = 253;

function reject(reason: string): StoreUrlResult {
  return { ok: false, reason };
}

/**
 * Validates a user-entered storefront URL and normalizes it to its origin.
 *
 * This is a syntactic check only. It does not resolve DNS, so a public-looking
 * hostname can still point at a private IP; outbound fetches also need SSRF
 * protection at connection time.
 */
export function parseStoreUrl(input: string): StoreUrlResult {
  const trimmed = input.trim();
  if (trimmed === "") {
    return reject("Enter your store's URL.");
  }

  const withScheme =
    SCHEME_PATTERN.test(trimmed) && trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return reject("That doesn't look like a valid URL.");
  }

  if (url.protocol !== "https:") {
    return reject("Only https:// store URLs are supported.");
  }

  if (url.username !== "" || url.password !== "") {
    return reject("Remove the username or password from the URL.");
  }

  if (url.port !== "") {
    return reject(
      "Custom ports aren't supported; storefronts are served on the default https port.",
    );
  }

  const hostname = url.hostname.endsWith(".") ? url.hostname.slice(0, -1) : url.hostname;

  if (hostname.startsWith("[") || IPV4_PATTERN.test(hostname)) {
    return reject("Use the store's domain name, not an IP address.");
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return reject("Local addresses can't be monitored.");
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => label === "")) {
    return reject("Enter a full domain name, like my-store.com.");
  }

  if (hostname.length > MAX_HOSTNAME_LENGTH) {
    return reject("That domain name is too long.");
  }

  return { ok: true, origin: `https://${hostname}` };
}

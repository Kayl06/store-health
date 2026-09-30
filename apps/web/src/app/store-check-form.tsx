"use client";

import {
  apiErrorSchema,
  parseStoreUrl,
  type StoreCheckOutcome,
  type StoreCheckResult,
  storeCheckResultSchema,
} from "@store-health/shared";
import { type FormEvent, useState } from "react";

const OUTCOME_LABELS: Record<StoreCheckOutcome, string> = {
  ok: "Online",
  password_protected: "Password protected",
  http_error: "HTTP error",
  blocked_redirect: "Blocked redirect",
  too_many_redirects: "Too many redirects",
  timeout: "Timed out",
  unreachable: "Unreachable",
};

export function StoreCheckForm() {
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StoreCheckResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const storeUrl = parseStoreUrl(url);
    if (!storeUrl.ok) {
      setError(storeUrl.reason);
      return;
    }

    setChecking(true);
    try {
      const response = await fetch("/api/store-checks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body: unknown = await response.json();

      if (response.ok) {
        setResult(storeCheckResultSchema.parse(body));
      } else {
        const apiError = apiErrorSchema.safeParse(body);
        setError(
          apiError.success ? apiError.data.error.message : "Something went wrong. Try again.",
        );
      }
    } catch {
      setError("Couldn't reach the store-health API. Is it running?");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="store-url" className="text-sm font-medium">
          Store URL
        </label>
        <div className="flex gap-2">
          <input
            id="store-url"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="my-store.myshopify.com"
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : "store-url-error"}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={checking}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {checking ? "Checking…" : "Check store"}
          </button>
        </div>
        {error !== null && (
          <p id="store-url-error" role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>

      {result !== null && <StoreCheckSummary result={result} />}
    </div>
  );
}

function StoreCheckSummary({ result }: { result: StoreCheckResult }) {
  return (
    <section
      aria-label="Check result"
      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="text-lg font-semibold">{OUTCOME_LABELS[result.outcome]}</h2>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-zinc-500">Status code</dt>
        <dd>{result.statusCode ?? "None"}</dd>
        <dt className="text-zinc-500">Response time</dt>
        <dd>{result.responseTimeMs} ms</dd>
        <dt className="text-zinc-500">Final URL</dt>
        <dd className="break-all">{result.finalUrl}</dd>
        <dt className="text-zinc-500">Shopify store</dt>
        <dd>{result.isShopify ? "Yes" : "No"}</dd>
        <dt className="text-zinc-500">Redirects</dt>
        <dd>
          {result.redirects.length === 0 ? (
            "None"
          ) : (
            <ol className="list-decimal pl-4">
              {result.redirects.map((hop) => (
                <li key={`${hop.from}->${hop.to}`} className="break-all">
                  {hop.statusCode}: {hop.from} → {hop.to}
                </li>
              ))}
            </ol>
          )}
        </dd>
      </dl>
    </section>
  );
}

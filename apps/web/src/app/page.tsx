import { StoreCheckForm } from "./store-check-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-24">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">store-health</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Monitor your clients&apos; Shopify stores for broken links, slow pages and front-end
          errors.
        </p>
      </div>
      <StoreCheckForm />
    </main>
  );
}

import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 4001);
const app = createApp({ fetch: globalThis.fetch });

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

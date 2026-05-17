import { serve } from "@hono/node-server";
import app from "./index.js";
import { logger } from "./lib/logger.js";

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  logger.info(`Server running on http://localhost:${port}`);
});

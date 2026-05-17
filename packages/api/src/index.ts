import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { authMiddleware } from "./lib/apiKey.js";
import { logger } from "./lib/logger.js";
import uploadRoute from "./routes/upload.js";
import listRoute from "./routes/list.js";
import deleteRoute from "./routes/delete.js";

const app = new Hono<{ Variables: { userId: string } }>();

app.use("/upload", authMiddleware);
app.use("/files/*", authMiddleware);

app.route("/upload", uploadRoute);
app.route("/files", listRoute);
app.route("/files", deleteRoute);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  logger.info(`Server running on http://localhost:${port}`);
});

export default app;

import { Hono } from "hono";
import { accessLogMiddleware } from "./lib/accessLog.js";
import { authMiddleware } from "./lib/apiKey.js";
import { ipAllowlistMiddleware } from "./lib/ipAllowlist.js";
import uploadRoute from "./routes/upload.js";
import listRoute from "./routes/list.js";
import deleteRoute from "./routes/delete.js";
import serveRoute from "./routes/serve.js";

const app = new Hono<{ Variables: { userId: string } }>();

app.use("*", accessLogMiddleware);
app.use("/upload", authMiddleware);
app.use("/files/*", authMiddleware);
app.use("/s/*", ipAllowlistMiddleware);

app.route("/upload", uploadRoute);
app.route("/files", listRoute);
app.route("/files", deleteRoute);
app.route("/s", serveRoute);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;

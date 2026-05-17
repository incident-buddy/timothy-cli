import { Hono } from "hono";
import { authMiddleware } from "./lib/apiKey.js";
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

export default app;

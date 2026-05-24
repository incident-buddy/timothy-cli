import { Hono } from "hono";
import { db } from "../lib/firebase.js";
import { getFileContent } from "../lib/storage.js";

const HTML_FILES_COLLECTION = "htmlFiles";

const app = new Hono();

app.get("/:id", async (c) => {
  const id = c.req.param("id");

  const doc = await db.collection(HTML_FILES_COLLECTION).doc(id).get();
  if (!doc.exists) return c.json({ error: "Not Found" }, 404);

  const data = doc.data()!;
  const expiresAt: Date = data.expiresAt.toDate();
  if (expiresAt < new Date()) return c.json({ error: "Gone" }, 410);

  const html = await getFileContent(data.storagePath);
  return c.html(html);
});

export default app;

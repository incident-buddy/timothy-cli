import { Hono } from "hono";
import { db } from "../lib/firebase.js";

const HTML_FILES_COLLECTION = "htmlFiles";

const app = new Hono<{ Variables: { userId: string } }>();

app.get("/", async (c) => {
  const userId = c.get("userId");

  const snapshot = await db
    .collection(HTML_FILES_COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  const files = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      description: data.description,
      expiresAt: data.expiresAt.toDate().toISOString(),
      createdAt: data.createdAt.toDate().toISOString(),
    };
  });

  return c.json({ files });
});

export default app;

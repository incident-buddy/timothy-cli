import type { Context, Next } from "hono";
import { db } from "./firebase.js";
import { logger } from "./logger.js";

export async function authMiddleware(c: Context, next: Next) {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
		logger.error("Bearer token missing or malformed");
    return c.json({ error: "Unauthorized" }, 401);
  }	

  const apiKey = authorization.slice(7);
  const snapshot = await db
    .collection("apiKeys")
    .where("key", "==", apiKey)
    .limit(1)
    .get();

  if (snapshot.empty) {
		logger.error("Invalid API key");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { userId } = snapshot.docs[0].data();
  c.set("userId", userId);
  await next();
}

import { Hono } from "hono";
import { db } from "../lib/firebase.js";
import { uploadHtml, generateSignedUrl } from "../lib/storage.js";
import { ulid } from "ulid";
import { addSeconds, now } from "../lib/time.js";

const STORAGE_BASE_PATH = "timothy-files";
const HTML_FILES_COLLECTION = "htmlFiles";

type UploadInput = {
  html: string;
  title: string;
  description: string;
  ttlDays: number;
};

type ParseResult = { ok: true; data: UploadInput } | { ok: false; error: string };

export function parseUploadRequest(body: unknown): ParseResult {
  if (
    typeof body !== "object" ||
    body === null ||
    !("html" in body) ||
    !("title" in body) ||
    !("description" in body) ||
    !("ttlDays" in body)
  ) {
    return { ok: false, error: "Missing required fields: html, title, description, ttlDays" };
  }

  const { html, title, description, ttlDays } = body as Record<string, unknown>;

  if (typeof html !== "string" || html.length === 0) {
    return { ok: false, error: "html must be a non-empty string" };
  }
  if (typeof title !== "string" || title.length === 0) {
    return { ok: false, error: "title must be a non-empty string" };
  }
  if (typeof description !== "string") {
    return { ok: false, error: "description must be a string" };
  }
  if (typeof ttlDays !== "number" || !Number.isInteger(ttlDays) || ttlDays <= 0) {
    return { ok: false, error: "ttlDays must be a positive integer" };
  }

  return { ok: true, data: { html, title, description, ttlDays } };
}

const app = new Hono<{ Variables: { userId: string } }>();

app.post("/", async (c) => {
  const userId = c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = parseUploadRequest(body);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }
  const { html, title, description, ttlDays } = parsed.data;

  const id = ulid();
  const storagePath = `${STORAGE_BASE_PATH}/${userId}/${id}.html`;
  const expiresAt = addSeconds(now(), ttlDays * 24 * 60 * 60);

  await uploadHtml(storagePath, html);
  const url = await generateSignedUrl(storagePath, expiresAt);

  await db.collection(HTML_FILES_COLLECTION).doc(id).set({
    userId,
    title,
    description,
    storagePath,
    expiresAt,
    createdAt: now(),
  });

  return c.json({ id, url, expiresAt: expiresAt.toISOString() });
});

export default app;

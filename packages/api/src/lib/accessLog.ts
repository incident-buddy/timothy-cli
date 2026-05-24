import type { Context, Next } from "hono";
import { logger } from "./logger.js";

export async function accessLogMiddleware(c: Context, next: Next) {
  const start = Date.now();
  await next();
  logger.info({
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    duration: Date.now() - start,
  });
}

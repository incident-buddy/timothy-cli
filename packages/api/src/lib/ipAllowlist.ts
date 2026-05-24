import type { Context, Next } from "hono";

function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function isInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;
  const [range, bits] = cidr.split("/");
  const mask = bits === "0" ? 0 : (~0 << (32 - parseInt(bits, 10))) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

function getClientIp(c: Context): string | null {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export async function ipAllowlistMiddleware(c: Context, next: Next): Promise<void | Response> {
  const raw = process.env.ALLOWED_IPS ?? "";
  if (!raw.trim()) return next();

  const allowlist = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const clientIp = getClientIp(c);

  if (!clientIp || !allowlist.some((entry) => isInCidr(clientIp, entry))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return next();
}

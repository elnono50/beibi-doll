import "server-only";
import { timingSafeEqual } from "node:crypto";
import { SITE_URL } from "./config";

/** Rechaza pedidos POST que no vengan desde nuestro propio sitio. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    const o = new URL(origin);
    return o.host === host || o.origin === new URL(SITE_URL).origin;
  } catch {
    return false;
  }
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

/**
 * Límite simple en memoria por instancia. Frena abusos básicos; para algo
 * estricto entre instancias conviene el firewall de Vercel.
 */
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

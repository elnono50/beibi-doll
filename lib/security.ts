import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { isDemo, SITE_URL } from "./config";
import { serviceClient } from "./supabase/service";

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
  // En Vercel estas cabeceras las pone la plataforma (el navegador no las puede falsificar)
  const v = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for") ?? "";
  return v.split(",")[0].trim() || "local";
}

/**
 * Límite en memoria por instancia: sólo de respaldo (vista previa o si la base
 * no responde). El límite real es `limit()`, compartido entre servidores.
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

/** Resume la clave (IP + acción) para no guardar IPs en claro en la base. */
function hashKey(key: string) {
  const salt = process.env.RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "beibi";
  return createHash("sha256").update(`${salt}:${key}`).digest("base64url").slice(0, 43);
}

/**
 * Límite de intentos compartido entre todas las instancias (vive en Postgres).
 * Si la base no responde, cae al límite en memoria en vez de dejar pasar todo.
 */
export async function limit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (isDemo || !process.env.SUPABASE_SERVICE_ROLE_KEY) return rateLimit(key, max, windowMs);
  try {
    const { data, error } = await serviceClient().rpc("rate_hit", {
      p_key: hashKey(key),
      p_limit: max,
      p_window_s: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) throw new Error(error.message);
    return data === true;
  } catch (e) {
    console.error("rate_hit", (e as Error).message);
    return rateLimit(key, max, windowMs);
  }
}

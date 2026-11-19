import "server-only";

/**
 * Verificación anti-bots de Cloudflare Turnstile (invisible para personas reales).
 * Sin TURNSTILE_SECRET_KEY queda apagada y no bloquea nada.
 */
export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token });
    if (ip && ip !== "local") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const data = (await res.json()) as { success?: boolean; hostname?: string };
    return data.success === true;
  } catch (e) {
    // Si Cloudflare no responde no frenamos ventas: el límite de intentos sigue activo
    console.error("turnstile", (e as Error).message);
    return true;
  }
}


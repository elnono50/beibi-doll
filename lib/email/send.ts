import "server-only";

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Destinatarias de los avisos internos (separadas por coma en ADMIN_NOTIFY_EMAIL). */
export const adminRecipients = () =>
  (process.env.ADMIN_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

const clean = (s: string) => s.replace(/[\r\n]+/g, " ").slice(0, 200);

function payload(m: Mail) {
  return {
    from: process.env.EMAIL_FROM,
    to: Array.isArray(m.to) ? m.to : [m.to],
    subject: clean(m.subject),
    html: m.html,
    text: m.text,
    reply_to: m.replyTo || process.env.EMAIL_REPLY_TO || undefined,
    headers: m.headers,
  };
}

/** Envía un mail. Nunca lanza: un mail fallido no puede romper una compra. */
export async function sendMail(m: Mail, idempotencyKey?: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey.slice(0, 250) } : {}),
      },
      body: JSON.stringify(payload(m)),
      cache: "no-store",
    });
    if (!res.ok) console.error("resend", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("resend", (e as Error).message);
    return false;
  }
}

/** Envío en tandas de hasta 100 (API batch de Resend). Devuelve cuántos salieron. */
export async function sendBatch(mails: Mail[], keyPrefix: string): Promise<{ sent: number; error?: string }> {
  if (!emailEnabled()) return { sent: 0, error: "Los envíos de mail todavía no están activos." };
  let sent = 0;
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${keyPrefix}-${i / 100}`.slice(0, 250),
        },
        body: JSON.stringify(chunk.map(payload)),
        cache: "no-store",
      });
      if (!res.ok) {
        const t = (await res.text()).slice(0, 300);
        console.error("resend batch", res.status, t);
        return {
          sent,
          error:
            res.status === 429
              ? "Se alcanzó el límite de envíos de hoy. El resto se puede mandar mañana."
              : "No se pudo completar el envío. Intentá de nuevo en unos minutos.",
        };
      }
      sent += chunk.length;
    } catch (e) {
      return { sent, error: (e as Error).message };
    }
  }
  return { sent };
}

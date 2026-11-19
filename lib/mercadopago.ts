import "server-only";
import { createHmac } from "node:crypto";
import { SITE_URL } from "./config";
import { safeEqual } from "./security";

const API = "https://api.mercadopago.com";

export const mpEnabled = () => Boolean(process.env.MP_ACCESS_TOKEN);

type PrefItem = { id: string; title: string; quantity: number; unit_price: number };

export async function createPreference(opts: {
  orderId: string;
  orderNumber: number;
  accessToken: string;
  items: PrefItem[];
  discount: number;
  shipping: number;
  total: number;
  payer: { name: string; email: string };
  expiresAt: string;
}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado");

  // Un único ítem con el total exacto evita diferencias de redondeo con descuentos.
  const detail = opts.items.map((i) => `${i.quantity}× ${i.title}`).join(", ").slice(0, 240);
  const back = `${SITE_URL}/pedido/${opts.orderId}?t=${opts.accessToken}`;
  const body = {
    items: [
      {
        id: `pedido-${opts.orderNumber}`,
        title: `Beibi Doll, pedido #${opts.orderNumber}`,
        description: detail,
        quantity: 1,
        currency_id: "ARS",
        unit_price: opts.total,
      },
    ],
    payer: { name: opts.payer.name, email: opts.payer.email },
    external_reference: opts.orderId,
    back_urls: { success: back, pending: back, failure: back },
    auto_return: "approved",
    binary_mode: true,
    notification_url: `${SITE_URL}/api/mp/webhook?source_news=webhooks`,
    statement_descriptor: "BRISELLE",
    expires: true,
    expiration_date_to: opts.expiresAt,
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
    metadata: { order_number: opts.orderNumber },
  };

  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `pref-${opts.orderId}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`MP preferencia ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; init_point: string };
  return data;
}

export type MpPayment = {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
};

export async function getPayment(id: string): Promise<MpPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token || !/^\d{1,20}$/.test(id)) return null;
  const res = await fetch(`${API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as MpPayment;
}

/**
 * Valida la firma x-signature de Mercado Pago.
 * Plantilla oficial: id:[data.id];request-id:[x-request-id];ts:[ts];
 */
export function verifyWebhookSignature(req: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    sig.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  // Una notificación repetida no es peligrosa: el pago siempre se vuelve a
  // consultar a la API de Mercado Pago antes de marcar nada.

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, v1);
}

/** Verifica un pago contra la API de MP y lo marca pagado si todo coincide. */
export function paymentMatches(p: MpPayment, order: { id: string; total: number }) {
  return (
    p.status === "approved" &&
    p.currency_id === "ARS" &&
    p.external_reference === order.id &&
    Math.abs(p.transaction_amount - order.total) < 0.01
  );
}

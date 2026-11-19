import "server-only";
import { SITE_URL } from "../config";
import { getSettings } from "../data";
import { serviceClient } from "../supabase/service";
import { variantLabel } from "../stock";
import type { Order, OrderItem } from "../types";
import { adminRecipients, emailEnabled, sendMail } from "./send";
import {
  adminNewOrder,
  adminWithdrawal,
  orderCancelled,
  orderDelivered,
  orderPaid,
  orderReady,
  orderReceived,
  orderShipped,
  stockBack,
  withdrawalReceived,
} from "./templates";

type FullOrder = Order & { items: OrderItem[] };

async function loadOrder(id: string): Promise<FullOrder | null> {
  const { data } = await serviceClient().from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
  return (data as FullOrder) ?? null;
}

export type OrderEvent = "created" | "paid" | "ready" | "shipped" | "delivered" | "cancelled";

/**
 * Manda los mails de un evento del pedido. Usa claves de idempotencia para
 * que el webhook y la página de vuelta de Mercado Pago no dupliquen envíos.
 */
export async function notifyOrder(orderId: string, event: OrderEvent) {
  if (!emailEnabled()) return;
  try {
    const [o, s] = await Promise.all([loadOrder(orderId), getSettings()]);
    if (!o) return;
    const admins = adminRecipients();
    const jobs: Promise<boolean>[] = [];

    if (event === "created" && o.payment_method !== "mercadopago") {
      jobs.push(sendMail({ to: o.email, ...orderReceived(o, s) }, `order-created-${o.id}`));
      if (admins.length) jobs.push(sendMail({ to: admins, replyTo: o.email, ...adminNewOrder(o, s, "created") }, `admin-created-${o.id}`));
    }
    if (event === "paid") {
      jobs.push(sendMail({ to: o.email, ...orderPaid(o, s) }, `order-paid-${o.id}`));
      if (o.payment_method === "mercadopago" && admins.length) {
        jobs.push(sendMail({ to: admins, replyTo: o.email, ...adminNewOrder(o, s, "paid") }, `admin-paid-${o.id}`));
      }
    }
    if (event === "ready" && o.shipping_method === "pickup") {
      jobs.push(sendMail({ to: o.email, ...orderReady(o, s) }, `order-ready-${o.id}`));
    }
    if (event === "delivered") jobs.push(sendMail({ to: o.email, ...orderDelivered(o, s) }, `order-delivered-${o.id}`));
    if (event === "shipped") jobs.push(sendMail({ to: o.email, ...orderShipped(o, s) }, `order-shipped-${o.id}`));
    if (event === "cancelled") jobs.push(sendMail({ to: o.email, ...orderCancelled(o, s) }, `order-cancelled-${o.id}`));
    await Promise.all(jobs);
  } catch (e) {
    console.error("notifyOrder", (e as Error).message);
  }
}

export async function notifyWithdrawal(r: { name: string; email: string; order_number: string; code: string }) {
  if (!emailEnabled()) return;
  try {
    const s = await getSettings();
    const admins = adminRecipients();
    await Promise.all([
      sendMail({ to: r.email, ...withdrawalReceived(r, s) }, `withdrawal-${r.code}`),
      admins.length ? sendMail({ to: admins, replyTo: r.email, ...adminWithdrawal(r, s) }, `admin-withdrawal-${r.code}`) : null,
    ]);
  } catch (e) {
    console.error("notifyWithdrawal", (e as Error).message);
  }
}

type AlertRow = {
  id: string;
  email: string;
  variant: { size: string; color: string; stock: number } | null;
  product: {
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    active: boolean;
    images: { url: string; color: string | null; sort: number }[];
  } | null;
};

/**
 * Manda "Volvió tu talle" a quienes lo pidieron, para cada talle que ya tiene
 * stock. Reclama cada aviso antes de enviarlo para no mandarlo dos veces.
 */
export async function notifyStockBack() {
  if (!emailEnabled()) return;
  try {
    const db = serviceClient();
    const { data } = await db
      .from("stock_alerts")
      .select(
        "id, email, variant:product_variants(size, color, stock), product:products(name, slug, price, compare_at_price, active, images:product_images(url, color, sort))",
      )
      .is("notified_at", null)
      .limit(500);
    const ready = ((data ?? []) as unknown as AlertRow[]).filter((a) => a.variant && a.variant.stock > 0 && a.product?.active);
    if (!ready.length) return;
    const { data: claimed } = await db
      .from("stock_alerts")
      .update({ notified_at: new Date().toISOString() })
      .in("id", ready.map((a) => a.id))
      .is("notified_at", null)
      .select("id");
    const ok = new Set((claimed ?? []).map((c) => c.id));
    const s = await getSettings();
    await Promise.all(
      ready
        .filter((a) => ok.has(a.id))
        .map((a) => {
          const p = a.product!;
          const v = a.variant!;
          const imgs = [...(p.images ?? [])].sort((x, y) => x.sort - y.sort);
          const image = (imgs.find((i) => i.color === v.color) ?? imgs[0])?.url ?? null;
          return sendMail(
            {
              to: a.email,
              ...stockBack(
                {
                  name: p.name,
                  price: p.price,
                  compare_at_price: p.compare_at_price,
                  image,
                  url: `${SITE_URL}/producto/${p.slug}`,
                  note: "",
                  size: variantLabel(v.color, v.size),
                },
                s,
              ),
            },
            `stock-back-${a.id}`,
          );
        }),
    );
  } catch (e) {
    console.error("notifyStockBack", (e as Error).message);
  }
}

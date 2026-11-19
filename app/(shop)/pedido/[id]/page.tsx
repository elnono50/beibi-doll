import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { notifyOrder } from "@/lib/email/notify";
import { CopyButton } from "@/components/CopyButton";
import { HangTag } from "@/components/HangTag";
import { isDemo } from "@/lib/config";
import { getSettings } from "@/lib/data";
import { dateTime, money, PAYMENT_LABEL, statusLabel } from "@/lib/format";
import { getPayment, paymentMatches } from "@/lib/mercadopago";
import { safeEqual } from "@/lib/security";
import { serviceClient } from "@/lib/supabase/service";
import type { Order, OrderItem, Settings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; payment_id?: string; pago?: string; status?: string }>;
};

async function loadOrder(id: string, token: string, paymentId?: string) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f]{48}$/.test(token)) return null;
  const db = serviceClient();
  const { data } = await db.from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
  if (!data || !safeEqual(data.access_token, token)) return null;
  let order = data as Order & { items: OrderItem[] };

  // Vuelta desde Mercado Pago: confirmamos contra la API por si el webhook se demora
  if (order.status === "pending" && order.payment_method === "mercadopago" && paymentId) {
    const p = await getPayment(paymentId);
    if (p && paymentMatches(p, order)) {
      const { data: result } = await db.rpc("mark_order_paid", {
        p_order_id: order.id,
        p_payment_id: String(p.id),
        p_amount: p.transaction_amount,
      });
      if (result === "ok") {
        const id = order.id;
        after(() => notifyOrder(id, "paid"));
      }
      const again = await db.from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
      if (again.data) order = again.data as typeof order;
    }
  }
  if (order.status === "pending" && order.reserved_until && new Date(order.reserved_until) < new Date()) {
    await db.rpc("release_expired_orders");
    order = { ...order, status: "expired" };
  }
  return order;
}

function demoOrder(pago: string): Order & { items: OrderItem[] } {
  const method = (["mercadopago", "transfer", "cash"].includes(pago) ? pago : "transfer") as Order["payment_method"];
  return {
    id: "demo",
    number: 1001,
    status: method === "mercadopago" ? "paid" : "pending",
    payment_method: method,
    customer_name: "Vista previa",
    email: "",
    phone: "",
    dni: null,
    shipping_method: method === "cash" ? "pickup" : "delivery",
    shipping_zone: method === "cash" ? null : "zona:via-cargo-domicilio",
    shipping_zone_label: method === "cash" ? null : "Vía Cargo a domicilio",
    shipping_eta: method === "cash" ? null : "De 3 a 6 días hábiles",
    shipping_branch: null,
    address: null,
    notes: null,
    subtotal: 32900,
    discount: 0,
    shipping_cost: method === "cash" ? 0 : 9900,
    total: method === "cash" ? 32900 : 42800,
    stock_reserved: true,
    stock_conflict: false,
    reserved_until: new Date(Date.now() + 48 * 3600e3).toISOString(),
    mp_payment_id: null,
    tracking_code: null,
    admin_notes: null,
    paid_at: null,
    created_at: new Date().toISOString(),
    items: [
      {
        id: "i1",
        product_id: "p-corset-noir",
        product_name: "Corset Noir",
        product_slug: "corset-noir",
        image_url: null,
        color: "Negro",
        size: "M",
        variant_label: "Negro · Talle M",
        quantity: 1,
        unit_price: 32900,
      },
    ],
  };
}

function headline(o: Order) {
  if (o.status === "expired") return { title: "Tu reserva venció", text: "No recibimos el pago a tiempo y liberamos las prendas. Podés volver a comprar cuando quieras." };
  if (o.status === "cancelled") return { title: "Pedido cancelado", text: "Este pedido fue cancelado. Si tenés dudas, escribinos." };
  if (o.status === "pending" && o.payment_method === "mercadopago")
    return { title: "Estamos esperando el pago", text: "Si ya pagaste, Mercado Pago puede tardar unos minutos en avisarnos. Esta página se actualiza sola." };
  if (o.status === "pending" && o.payment_method === "transfer")
    return { title: "¡Ya casi es tuyo!", text: "Transferí el total y mandanos el comprobante. Te guardamos las prendas mientras tanto." };
  if (o.status === "pending" && o.payment_method === "cash")
    return { title: "Te esperamos", text: "Te avisamos por mail cuando esté listo para retirar. Pagás en efectivo cuando lo buscás." };
  if (o.status === "preparing" && o.shipping_method === "pickup")
    return { title: "Listo para retirar", text: "Tu pedido ya está separado. Pasá por el local cuando quieras, en el horario de atención." };
  if (o.status === "shipped")
    return {
      title: "Tu pedido está en camino",
      text: [
        o.shipping_zone_label && `Lo enviamos por ${o.shipping_zone_label}.`,
        o.tracking_code && `Código de seguimiento: ${o.tracking_code}.`,
        o.shipping_branch && `Lo retirás en: ${o.shipping_branch}.`,
      ]
        .filter(Boolean)
        .join(" ") || "Ya lo despachamos.",
    };
  if (o.status === "delivered")
    return { title: o.shipping_method === "pickup" ? "Pedido retirado" : "Pedido entregado", text: "Gracias por elegir Beibi Doll." };
  return {
    title: "¡Gracias por tu compra!",
    text:
      o.shipping_method === "pickup"
        ? "Recibimos tu pago. Te avisamos por mail cuando esté listo para retirar."
        : "Recibimos tu pago. Te avisamos por mail cuando despachemos el pedido.",
  };
}

function waLink(s: Settings, o: Order) {
  if (!s.contact.whatsapp) return null;
  const msg = `Hola! Te escribo por mi pedido #${o.number} de Beibi Doll${o.payment_method === "transfer" ? ". Te paso el comprobante de la transferencia." : "."}`;
  return `https://wa.me/${s.contact.whatsapp}?text=${encodeURIComponent(msg)}`;
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const settings = await getSettings();

  let order: (Order & { items: OrderItem[] }) | null = null;
  if (id === "demo") {
    if (!isDemo) notFound();
    order = demoOrder(sp.pago ?? "");
  } else {
    if (isDemo) notFound();
    order = await loadOrder(id, sp.t ?? "", sp.payment_id);
  }
  if (!order) notFound();

  const h = headline(order);
  const wa = waLink(settings, order);
  const t = settings.payments.transfer;
  const showBank = order.status === "pending" && order.payment_method === "transfer";
  const waitingMp = order.status === "pending" && order.payment_method === "mercadopago";

  return (
    <div className="wrap">
      {waitingMp && <meta httpEquiv="refresh" content="12" />}
      <div className="order">
        <HangTag swing className="order__tag-wrap" tagClassName="order__tag">
          <span className="order__num">Pedido #{order.number}</span>
          <h1>{h.title}</h1>
          <p style={{ color: "var(--sea-soft)", maxWidth: "40ch" }}>{h.text}</p>
          <span className={`status-pill status-pill--${order.status}`}>{statusLabel(order.status, order.shipping_method)}</span>
        </HangTag>

        {showBank && (
          <section className="form-block" aria-labelledby="bank-title">
            <h2 id="bank-title">Datos para transferir {money(order.total)}</h2>
            {t.alias || t.cbu ? (
              <div className="bank">
                {t.alias && (
                  <div className="bank__row">
                    <span>Alias</span>
                    <code>{t.alias}</code>
                    <CopyButton value={t.alias} label="alias" />
                  </div>
                )}
                {t.cbu && (
                  <div className="bank__row">
                    <span>CBU / CVU</span>
                    <code>{t.cbu}</code>
                    <CopyButton value={t.cbu} label="CBU" />
                  </div>
                )}
                {t.holder && (
                  <div className="bank__row">
                    <span>Titular</span>
                    <code>{t.holder}</code>
                    <span />
                  </div>
                )}
                {t.bank && (
                  <div className="bank__row">
                    <span>Banco</span>
                    <code>{t.bank}</code>
                    <span />
                  </div>
                )}
                {t.cuit && (
                  <div className="bank__row">
                    <span>CUIT</span>
                    <code>{t.cuit}</code>
                    <span />
                  </div>
                )}
                <div className="bank__row">
                  <span>Importe</span>
                  <code>{money(order.total)}</code>
                  <CopyButton value={String(order.total)} label="importe" />
                </div>
              </div>
            ) : (
              <p className="notice">Te enviamos los datos bancarios por WhatsApp o email en breve.</p>
            )}
            {order.reserved_until && (
              <p className="notice">Te guardamos las prendas hasta el {dateTime(order.reserved_until)}.</p>
            )}
          </section>
        )}

        {wa && (order.status === "pending" || order.status === "paid") && order.payment_method !== "mercadopago" && (
          <a className="btn" href={wa} target="_blank" rel="noopener noreferrer" style={{ justifySelf: "center" }}>
            {showBank ? "Enviar comprobante por WhatsApp" : "Escribinos por WhatsApp"}
          </a>
        )}

        <section className="form-block" aria-labelledby="sum-title">
          <h2 id="sum-title">Resumen</h2>
          {order.items.map((it) => (
            <div className="sum-row" key={it.id}>
              <span>
                {it.product_name} <span style={{ color: "var(--sea-mute)" }}>({it.variant_label})</span>
                {it.quantity > 1 ? ` × ${it.quantity}` : ""}
              </span>
              <span>{money(it.unit_price * it.quantity)}</span>
            </div>
          ))}
          {order.discount > 0 && (
            <div className="sum-row">
              <span>Descuento</span>
              <span>−{money(order.discount)}</span>
            </div>
          )}
          <div className="sum-row">
            <span>{order.shipping_method === "pickup" ? "Retiro en el local" : `Envío: ${order.shipping_zone_label ?? ""}`}</span>
            <span>{order.shipping_cost ? money(order.shipping_cost) : "Gratis"}</span>
          </div>
          <div className="sum-row sum-row--total">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
          <p style={{ fontSize: "var(--t-sm)", color: "var(--sea-mute)" }}>Pago: {PAYMENT_LABEL[order.payment_method]}</p>
        </section>

        <p style={{ fontSize: "var(--t-sm)", color: "var(--sea-mute)", textAlign: "center" }}>
          Guardá este enlace para ver el estado de tu pedido. <Link href="/tienda">Seguir comprando</Link>
        </p>
      </div>
    </div>
  );
}

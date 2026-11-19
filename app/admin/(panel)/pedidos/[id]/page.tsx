import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderActions } from "@/components/admin/OrderActions";
import { adminOrder } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { dateTime, money, PAYMENT_LABEL, statusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin();
  const o = await adminOrder(admin.supabase, id);
  if (!o) notFound();
  const phone = o.phone.replace(/\D/g, "");
  const wa = phone ? `https://wa.me/${phone.startsWith("54") ? phone : `549${phone.replace(/^0/, "")}`}` : null;
  const a = o.address;

  return (
    <>
      <div className="admin-head">
        <div>
          <Link href="/admin/pedidos" className="link">
            Pedidos
          </Link>
          <h1 style={{ marginTop: 8 }}>Pedido #{o.number}</h1>
          <p>
            Hecho el {dateTime(o.created_at)}. Pago: {PAYMENT_LABEL[o.payment_method]}
          </p>
        </div>
        <span className={`status-pill status-pill--${o.status}`}>{statusLabel(o.status, o.shipping_method)}</span>
      </div>

      {o.stock_conflict && (
        <p className="notice notice--error">
          Este pago llegó después de que venciera la reserva y no alcanzó el stock para algún talle. Revisá si podés
          cumplirlo o devolvé el dinero desde Mercado Pago.
        </p>
      )}
      {o.status === "pending" && o.reserved_until && (
        <p className="notice">Los talles quedan reservados hasta el {dateTime(o.reserved_until)}. Si no se paga, vuelven solos al stock.</p>
      )}

      <div className="two-col">
        <div className="form-stack" style={{ gap: 24 }}>
          <section className="panel">
            <h2>Productos</h2>
            <div className="order-items">
              {o.items.map((it) => (
                <div className="order-item" key={it.id}>
                  <span className="thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {it.image_url && <img src={it.image_url} alt="" />}
                  </span>
                  <span>
                    <b style={{ fontWeight: 500 }}>{it.product_name}</b>
                    <br />
                    <span className="muted">
                      {it.variant_label}
                      {it.quantity > 1 ? `, ${it.quantity} unidades` : ""}
                    </span>
                  </span>
                  <span>{money(it.unit_price * it.quantity)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="sum-row">
                <span>Subtotal</span>
                <span>{money(o.subtotal)}</span>
              </div>
              {o.discount > 0 && (
                <div className="sum-row">
                  <span>Descuento</span>
                  <span>−{money(o.discount)}</span>
                </div>
              )}
              <div className="sum-row">
                <span>Envío</span>
                <span>{o.shipping_cost ? money(o.shipping_cost) : "Gratis"}</span>
              </div>
              <div className="sum-row sum-row--total">
                <span>Total</span>
                <span>{money(o.total)}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2>Clienta</h2>
            <dl className="kv">
              <dt>Nombre</dt>
              <dd>{o.customer_name}</dd>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${o.email}`}>{o.email}</a>
              </dd>
              <dt>Teléfono</dt>
              <dd>
                {o.phone}
                {wa && (
                  <>
                    {" "}
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="link">
                      Abrir WhatsApp
                    </a>
                  </>
                )}
              </dd>
              {o.dni && (
                <>
                  <dt>DNI</dt>
                  <dd>{o.dni}</dd>
                </>
              )}
              <dt>Entrega</dt>
              <dd>
                {o.shipping_method === "pickup" ? (
                  "Retira en el local"
                ) : a ? (
                  <>
                    {a.street} {a.number}
                    {a.floor ? `, ${a.floor}` : ""}
                    <br />
                    {a.city}, {a.province} ({a.zip})
                    <br />
                    <span className="muted">
                      {o.shipping_zone_label}
                      {o.shipping_eta ? `, ${o.shipping_eta}` : ""}
                    </span>
                    {o.shipping_branch && (
                      <>
                        <br />
                        <b style={{ fontWeight: 500 }}>Sucursal: {o.shipping_branch}</b>
                      </>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </dd>
              {o.notes && (
                <>
                  <dt>Notas</dt>
                  <dd>{o.notes}</dd>
                </>
              )}
              {o.mp_payment_id && (
                <>
                  <dt>Pago MP</dt>
                  <dd>N.º {o.mp_payment_id}</dd>
                </>
              )}
            </dl>
          </section>
        </div>
        <OrderActions order={o} />
      </div>
    </>
  );
}

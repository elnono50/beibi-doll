import type { Metadata } from "next";
import Link from "next/link";
import { adminOrders, adminProducts, releaseExpired } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { dateTime, money, statusLabel } from "@/lib/format";
import { variantLabel } from "@/lib/stock";

export const metadata: Metadata = { title: "Resumen" };

const SOLD = ["paid", "preparing", "shipped", "delivered"];

export default async function Dashboard() {
  const admin = await getAdmin();
  await releaseExpired(admin.supabase);
  const [orders, products] = await Promise.all([adminOrders(admin.supabase), adminProducts(admin.supabase)]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSales = orders.filter((o) => SOLD.includes(o.status) && new Date(o.paid_at ?? o.created_at) >= monthStart);
  const toPrepare = orders.filter((o) => o.status === "paid" || o.status === "preparing");
  const pending = orders.filter((o) => o.status === "pending");
  const low = products
    .filter((p) => p.active)
    .flatMap((p) => p.variants.filter((v) => v.stock <= 2).map((v) => ({ p, v })))
    .sort((a, b) => a.v.stock - b.v.stock)
    .slice(0, 12);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Hola, Fer</h1>
          <p>Esto es lo que pasa en la tienda.</p>
        </div>
        <div className="admin-head__actions">
          <Link href="/admin/productos/nuevo" className="btn">
            Nuevo producto
          </Link>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{money(monthSales.reduce((a, o) => a + o.total, 0))}</b>
          <span>Vendido este mes</span>
        </div>
        <div className="stat">
          <b>{monthSales.length}</b>
          <span>Pedidos pagados este mes</span>
        </div>
        <Link className="stat" href="/admin/pedidos?estado=paid">
          <b>{toPrepare.length}</b>
          <span>Para preparar y enviar</span>
        </Link>
        <Link className="stat" href="/admin/pedidos?estado=pending">
          <b>{pending.length}</b>
          <span>Esperando pago</span>
        </Link>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Últimos pedidos</h2>
          {orders.length === 0 ? (
            <p className="muted">Todavía no hay pedidos. Cuando alguien compre, aparece acá.</p>
          ) : (
            <div className="table-wrap">
              <table className="atable">
                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/pedidos/${o.id}`}>
                          <b style={{ fontWeight: 500 }}>#{o.number}</b>
                        </Link>
                        <br />
                        <span className="muted">{dateTime(o.created_at)}</span>
                      </td>
                      <td>{o.customer_name}</td>
                      <td>{money(o.total)}</td>
                      <td>
                        <span className={`status-pill status-pill--${o.status}`}>{statusLabel(o.status, o.shipping_method)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/admin/pedidos" className="link" style={{ justifySelf: "start" }}>
            Ver todos los pedidos
          </Link>
        </section>

        <section className="panel">
          <h2>Poco stock</h2>
          {low.length === 0 ? (
            <p className="muted">Todos los talles tienen más de 2 unidades.</p>
          ) : (
            <table className="atable">
              <tbody>
                {low.map(({ p, v }) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/productos/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="muted">
                      {variantLabel(v.color, v.size)}
                    </td>
                    <td style={{ color: v.stock === 0 ? "var(--error)" : undefined, fontWeight: 500 }}>
                      {v.stock === 0 ? "Agotado" : v.stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link href="/admin/stock" className="link" style={{ justifySelf: "start" }}>
            Reponer stock
          </Link>
        </section>
      </div>
    </>
  );
}

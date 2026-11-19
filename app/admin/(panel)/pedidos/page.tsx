import type { Metadata } from "next";
import Link from "next/link";
import { adminOrders, releaseExpired } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { dateTime, money, PAYMENT_LABEL, statusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Pedidos" };

const TABS = [
  { key: "", label: "Todos" },
  { key: "paid", label: "Para preparar" },
  { key: "pending", label: "Esperando pago" },
  { key: "preparing", label: "En preparación" },
  { key: "shipped", label: "Enviados" },
  { key: "delivered", label: "Entregados" },
  { key: "cancelled", label: "Cancelados" },
  { key: "expired", label: "Vencidos" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado = "" } = await searchParams;
  const admin = await getAdmin();
  await releaseExpired(admin.supabase);
  const status = TABS.some((t) => t.key === estado) ? estado : "";
  const orders = await adminOrders(admin.supabase, status || undefined);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Pedidos</h1>
          <p>Los pagos con Mercado Pago se confirman solos. Las transferencias las confirmás vos.</p>
        </div>
      </div>
      <section className="panel">
        <nav className="tabs" aria-label="Filtrar por estado">
          {TABS.map((t) => (
            <Link key={t.key} href={t.key ? `/admin/pedidos?estado=${t.key}` : "/admin/pedidos"} className="chip" aria-current={status === t.key ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        {orders.length === 0 ? (
          <div className="empty-state">
            <p>No hay pedidos {status ? "en este estado" : "todavía"}.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Clienta</th>
                  <th scope="col">Pago</th>
                  <th scope="col">Entrega</th>
                  <th scope="col">Total</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/pedidos/${o.id}`}>
                        <b style={{ fontWeight: 500 }}>#{o.number}</b>
                      </Link>
                      <br />
                      <span className="muted">{dateTime(o.created_at)}</span>
                    </td>
                    <td>{o.customer_name}</td>
                    <td>{PAYMENT_LABEL[o.payment_method]}</td>
                    <td>{o.shipping_method === "pickup" ? "Retiro" : o.shipping_zone_label}</td>
                    <td>{money(o.total)}</td>
                    <td>
                      <span className={`status-pill status-pill--${o.status}`}>{statusLabel(o.status, o.shipping_method)}</span>
                      {o.stock_conflict && (
                        <>
                          <br />
                          <span style={{ color: "var(--error)", fontSize: "var(--t-xs)" }}>Revisar stock</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

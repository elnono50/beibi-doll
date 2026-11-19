import type { Metadata } from "next";
import { WithdrawalToggle } from "@/components/admin/WithdrawalToggle";
import { adminWithdrawals } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Arrepentimientos" };

export default async function WithdrawalsPage() {
  const admin = await getAdmin();
  const list = await adminWithdrawals(admin.supabase);
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Arrepentimientos</h1>
          <p>Pedidos de devolución hechos con el botón de arrepentimiento. La ley da 10 días corridos desde la entrega.</p>
        </div>
      </div>
      <section className="panel">
        {list.length === 0 ? (
          <div className="empty-state">
            <p>No hay solicitudes.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Pedido</th>
                  <th scope="col">Clienta</th>
                  <th scope="col">Comentario</th>
                  <th scope="col">Código</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td>{dateTime(w.created_at)}</td>
                    <td>#{w.order_number}</td>
                    <td>
                      {w.name}
                      <br />
                      <a href={`mailto:${w.email}`} className="muted">
                        {w.email}
                      </a>
                      {w.phone && (
                        <>
                          <br />
                          <span className="muted">{w.phone}</span>
                        </>
                      )}
                    </td>
                    <td style={{ maxWidth: 280 }}>{w.reason || <span className="muted">Sin comentario</span>}</td>
                    <td>{w.code}</td>
                    <td>
                      <WithdrawalToggle id={w.id} handled={w.handled} />
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

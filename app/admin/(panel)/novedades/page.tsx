import type { Metadata } from "next";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";
import { adminProducts, adminSettings } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { emailEnabled } from "@/lib/email/send";
import { dateTime } from "@/lib/format";
import { listSubscribers } from "@/lib/subscribers";

export const metadata: Metadata = { title: "Novedades" };

const SOURCE: Record<string, string> = { web: "Pie de página", cuenta: "Al crear cuenta", checkout: "Al comprar" };

export default async function NewsAdmin() {
  const admin = await getAdmin();
  const [{ rows, customers, missing }, settings, products] = await Promise.all([
    listSubscribers(admin.supabase),
    adminSettings(admin.supabase),
    adminProducts(admin.supabase),
  ]);
  const active = rows.filter((r) => !r.unsubscribed_at);

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Novedades</h1>
          <p>Escribí y mandá mails de novedades con el diseño de Beibi Doll, o descargá la lista para usarla en otra herramienta.</p>
        </div>
        {active.length > 0 && (
          <a href="/admin/novedades-csv" className="btn">
            Descargar lista (CSV)
          </a>
        )}
      </div>

      {missing && (
        <p className="notice notice--error">La lista de suscriptas todavía no está disponible.</p>
      )}

      <div className="stats" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="stat">
          <b>{active.length}</b>
          <span>Suscriptas activas</span>
        </div>
        <div className="stat">
          <b>{customers}</b>
          <span>Cuentas creadas</span>
        </div>
        <div className="stat">
          <b>{rows.length - active.length}</b>
          <span>Se dieron de baja</span>
        </div>
      </div>

      <NewsletterComposer
        settings={settings}
        products={products.filter((p) => p.active)}
        activeCount={active.length}
        siteUrl={SITE_URL}
        demo={admin.demo}
        enabled={emailEnabled()}
      />

      <section className="panel">
        <h2>Lista</h2>
        <p className="panel__hint">
          Cada mail que mandes tiene que incluir un enlace de baja. En el CSV va el enlace personal de cada persona en la
          columna “baja”.
        </p>
        {rows.length === 0 ? (
          <div className="empty-state">
            <p>Todavía no se suscribió nadie. El formulario está al pie de todas las páginas de la tienda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Dónde se sumó</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((r) => (
                  <tr key={r.id}>
                    <td>{r.email}</td>
                    <td>{r.name || <span className="muted">—</span>}</td>
                    <td>{SOURCE[r.source] ?? r.source}</td>
                    <td>{dateTime(r.consent_at)}</td>
                    <td>
                      {r.unsubscribed_at ? (
                        <span className="status-pill status-pill--cancelled">De baja</span>
                      ) : (
                        <span className="status-pill status-pill--delivered">Activa</span>
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

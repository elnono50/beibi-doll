import type { Metadata } from "next";
import { NewsletterComposer } from "@/components/admin/NewsletterComposer";
import { adminProducts, adminSettings } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { dailyLimit, emailEnabled } from "@/lib/email/send";
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
  const campaigns = admin.supabase
    ? (
        await admin.supabase
          .from("email_campaigns")
          .select("id, subject, recipients, sent, status, error, created_at")
          .order("created_at", { ascending: false })
          .limit(8)
      ).data ?? []
    : [];
  const cap = dailyLimit();

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

      {cap > 0 && (
        <p className="panel__hint" style={{ marginTop: -8 }}>
          Tu plan de mails permite {cap} envíos por día entre compras y novedades. Si la lista es más grande, las novedades
          salen en tandas durante los días siguientes, sin que dejen de llegar los mails de las compras.
        </p>
      )}

      {campaigns.length > 0 && (
        <section className="panel">
          <h2>Últimos envíos</h2>
          <div className="table-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Asunto</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Enviados</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.subject}</td>
                    <td>{dateTime(c.created_at)}</td>
                    <td>
                      {c.sent} de {c.recipients}
                    </td>
                    <td>
                      {c.status === "sending" ? (
                        <span className="status-pill status-pill--pending">{c.error ? "Con error, reintenta mañana" : "Sigue mañana"}</span>
                      ) : c.status === "error" ? (
                        <span className="status-pill status-pill--cancelled">Error</span>
                      ) : (
                        <span className="status-pill status-pill--delivered">Enviado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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

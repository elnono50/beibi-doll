import type { Metadata } from "next";
import { PasswordForm } from "@/components/admin/PasswordForm";
import { getAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Mi cuenta" };

const ACTION: Record<string, string> = {
  cambio_medios_de_pago: "Cambiaron los medios de pago",
  alta_administradora: "Se agregó una administradora",
  baja_administradora: "Se quitó una administradora",
};

export default async function AccountPage() {
  const admin = await getAdmin();

  let factor: { friendly_name?: string; created_at: string } | null = null;
  let log: { id: number; at: string; actor_email: string | null; action: string }[] = [];
  if (admin.supabase) {
    const [{ data: f }, { data: l }] = await Promise.all([
      admin.supabase.auth.mfa.listFactors(),
      admin.supabase.from("audit_log").select("id, at, actor_email, action").order("at", { ascending: false }).limit(10),
    ]);
    factor = f?.totp.find((x) => x.status === "verified") ?? null;
    log = l ?? [];
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Mi cuenta</h1>
          <p>Ingresás como {admin.email}.</p>
        </div>
      </div>

      <section className="panel">
        <h2>Verificación en dos pasos</h2>
        {admin.demo ? (
          <p className="panel__hint">En la tienda real, el panel pide además un código de la app del celular.</p>
        ) : (
          <p className="panel__hint">
            Activa{factor ? ` desde el ${dateTime(factor.created_at)}` : ""}. Cada vez que entres al panel te va a pedir el
            código de 6 números de la app del celular. Si cambiás o perdés el celular, pedile a quien te armó la tienda que
            reinicie la verificación y la volvés a vincular.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Cambiar contraseña</h2>
        <PasswordForm email={admin.email} demo={admin.demo} />
      </section>

      {!admin.demo && (
        <section className="panel">
          <h2>Cambios sensibles</h2>
          <p className="panel__hint">
            Queda registrado cada cambio en los medios de pago y en las administradoras. También te llega un mail cuando
            cambian los datos de cobro. Si ves algo que no hiciste, cambiá tu contraseña y avisá.
          </p>
          {log.length === 0 ? (
            <div className="empty-state">
              <p>Todavía no hay cambios registrados.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="atable">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Qué pasó</th>
                    <th scope="col">Cuenta</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.id}>
                      <td>{dateTime(r.at)}</td>
                      <td>{ACTION[r.action] ?? r.action}</td>
                      <td>{r.actor_email ?? "Sistema"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountProfile, SignOutButton } from "@/components/AccountProfile";
import { isDemo } from "@/lib/config";
import { dateTime, money, statusLabel } from "@/lib/format";
import { serviceClient } from "@/lib/supabase/service";
import { sessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

type Row = {
  id: string;
  number: number;
  access_token: string;
  status: string;
  total: number;
  created_at: string;
  tracking_code: string | null;
  shipping_method: string;
  items: { product_name: string; variant_label: string; quantity: number }[];
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ bienvenida?: string }> }) {
  const { bienvenida } = await searchParams;
  if (isDemo) {
    return (
      <div className="wrap">
        <article className="prose">
          <h1>Mi cuenta</h1>
          <p>En la vista previa no hay cuentas. Cuando la tienda esté conectada, acá se ven los pedidos y los datos.</p>
        </article>
      </div>
    );
  }
  const sb = await sessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/cuenta/ingresar");

  const [{ data: profile }, { data: orders }, { data: adm }] = await Promise.all([
    sb.from("customers").select("name, phone, marketing_opt_in").eq("user_id", user.id).maybeSingle(),
    // Columnas seguras únicamente; filtrado por la sesión validada
    serviceClient()
      .from("orders")
      .select("id, number, access_token, status, total, created_at, tracking_code, shipping_method, items:order_items(product_name, variant_label, quantity)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const list = (orders ?? []) as Row[];
  const name = profile?.name || "";

  return (
    <div className="wrap">
      <div className="account">
        <header className="account__head">
          <div>
            <h1>{name ? `Hola, ${name.split(" ")[0]}` : "Mi cuenta"}</h1>
            <p className="muted">{user.email}</p>
          </div>
          <SignOutButton />
        </header>
        {adm && (
          <p className="notice">
            Esta cuenta administra la tienda. <Link href="/admin">Ir al panel</Link>
          </p>
        )}
        {bienvenida && <p className="notice notice--ok">Tu cuenta quedó confirmada. ¡Bienvenida a Beibi Doll!</p>}

        <div className="account__grid">
          <section aria-labelledby="orders-title">
            <h2 id="orders-title">Mis pedidos</h2>
            {list.length === 0 ? (
              <div className="empty" style={{ paddingBlock: 24 }}>
                <p className="muted">Todavía no hiciste pedidos con esta cuenta.</p>
                <Link href="/tienda" className="btn btn--ghost">
                  Ver la tienda
                </Link>
              </div>
            ) : (
              <ul className="order-list">
                {list.map((o) => (
                  <li key={o.id}>
                    <Link href={`/pedido/${o.id}?t=${o.access_token}`} className="order-card">
                      <span className="order-card__top">
                        <b>Pedido #{o.number}</b>
                        <span className={`status-pill status-pill--${o.status}`}>{statusLabel(o.status, o.shipping_method)}</span>
                      </span>
                      <span className="muted">
                        {o.items.map((i) => `${i.product_name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                      </span>
                      <span className="order-card__bottom">
                        <span className="muted">{dateTime(o.created_at)}</span>
                        <span>{money(o.total)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="account__side" aria-labelledby="data-title">
            <h2 id="data-title">Mis datos</h2>
            <AccountProfile
              userId={user.id}
              initial={{
                name: profile?.name ?? "",
                phone: profile?.phone ?? "",
                marketing_opt_in: profile?.marketing_opt_in ?? false,
              }}
            />
            <p className="muted" style={{ fontSize: "var(--t-xs)" }}>
              Para cambiar la contraseña, cerrá sesión y usá “Olvidé mi contraseña”.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

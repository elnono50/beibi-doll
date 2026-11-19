import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/admin/actions";
import { isDemo } from "@/lib/config";
import { sessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sin acceso" };

export default async function NoAccess() {
  if (isDemo) redirect("/admin");
  const sb = await sessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  return (
    <main className="login">
      <div className="panel" style={{ maxWidth: 440 }}>
        <h1 style={{ fontSize: "var(--t-2xl)" }}>Esta cuenta no tiene acceso al panel</h1>
        <p className="muted">
          Ingresaste como {user.email}. El panel es sólo para quienes administran la tienda.
        </p>
        <div className="actions-row">
          <Link href="/cuenta" className="btn">
            Ir a mi cuenta
          </Link>
          <form action={signOut}>
            <button className="btn btn--ghost">Salir</button>
          </form>
        </div>
      </div>
    </main>
  );
}

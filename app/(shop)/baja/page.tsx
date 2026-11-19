import type { Metadata } from "next";
import Link from "next/link";
import { isDemo } from "@/lib/config";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Darte de baja", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  let ok = false;
  if (!isDemo && /^[0-9a-f]{48}$/.test(t)) {
    const { data } = await serviceClient().rpc("unsubscribe", { p_token: t });
    ok = data === true;
  }
  return (
    <div className="wrap">
      <article className="prose">
        <h1>{ok ? "Te diste de baja" : "No encontramos tu suscripción"}</h1>
        <p>
          {ok
            ? "Ya no vas a recibir novedades ni promociones por email. Si fue un error, podés volver a suscribirte desde el pie de cualquier página."
            : "El enlace puede estar incompleto. Escribinos y te damos de baja a mano."}
        </p>
        <p style={{ marginTop: 24 }}>
          <Link href="/" className="btn btn--ghost">
            Volver a la tienda
          </Link>
        </p>
      </article>
    </div>
  );
}

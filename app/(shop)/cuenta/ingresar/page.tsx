import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/AccountAuthForm";
import { HangTag } from "@/components/HangTag";
import { isDemo } from "@/lib/config";
import { sessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingresar o crear cuenta", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ modo?: string; error?: string }> }) {
  const { modo, error } = await searchParams;
  if (!isDemo) {
    const sb = await sessionClient();
    const { data } = await sb.auth.getUser();
    if (data.user) {
      const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
      redirect(adm ? "/admin" : "/cuenta");
    }
  }
  return (
    <section className="tag-stage" aria-labelledby="auth-title">
      <HangTag swing className="tag-stage__wrap" tagClassName="tag-stage__tag">
        <span className="pass__brand brand-script">Beibi.doll</span>
        <h1 id="auth-title">Tu cuenta</h1>
        <p className="tag-stage__lead">Seguí tus pedidos, comprá más rápido y enterate primero de las novedades.</p>
        {error === "enlace" && (
          <p className="notice">
            Tu email quedó confirmado, pero el enlace se abrió en otro navegador. Ingresá con tu email y contraseña.
          </p>
        )}
        <AccountAuthForm demo={isDemo} initial={modo === "registro" ? "signup" : "login"} />
        <p className="tag-stage__note">No hace falta tener cuenta para comprar.</p>
      </HangTag>
    </section>
  );
}

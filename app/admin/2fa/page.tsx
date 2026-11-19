import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactor } from "@/components/admin/TwoFactor";
import { hasSecondFactor } from "@/lib/auth";
import { isDemo } from "@/lib/config";
import { sessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificación en dos pasos", robots: { index: false, follow: false } };

/**
 * Segundo paso del panel: código de 6 números de una app del celular
 * (Google Authenticator, Microsoft Authenticator, 1Password…).
 * La primera vez se vincula el celular escaneando un QR.
 */
export default async function TwoFactorPage() {
  if (isDemo) redirect("/admin");
  const sb = await sessionClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: admin } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/admin/sin-acceso");
  if (await hasSecondFactor(sb)) redirect("/admin");

  return (
    <main className="login">
      <TwoFactor email={user.email ?? ""} />
    </main>
  );
}

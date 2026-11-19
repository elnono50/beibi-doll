import "server-only";
import { redirect } from "next/navigation";
import { isDemo } from "./config";
import { sessionClient } from "./supabase/server";

export class DemoError extends Error {}

type Session = Awaited<ReturnType<typeof sessionClient>>;

/** true si la sesión ya pasó el código de la app (aal2). */
export async function hasSecondFactor(supabase: Session) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

/**
 * Para CADA página del panel (el layout no alcanza: en la navegación interna
 * Next puede renderizar sólo la página). Redirige si no hay sesión o si la
 * cuenta no está en la lista de administradoras.
 */
export async function getAdmin() {
  if (isDemo) return { demo: true as const, email: "vista previa", supabase: null };
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) redirect("/admin/sin-acceso");
  // Segundo paso obligatorio (la base además lo exige en is_admin())
  if (!(await hasSecondFactor(supabase))) redirect("/admin/2fa");
  return { demo: false as const, email: user.email ?? "", supabase };
}

/** Para server actions: lanza si no es administradora. */
export async function requireAdmin() {
  if (isDemo) throw new DemoError("En la vista previa los cambios no se guardan.");
  const supabase = await sessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a ingresar.");
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!data) throw new Error("Esta cuenta no tiene permiso de administradora.");
  if (!(await hasSecondFactor(supabase))) throw new Error("Ingresá el código de tu app de verificación para seguir (volvé a entrar al panel).");
  return supabase;
}

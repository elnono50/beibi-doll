import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { sessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Vuelta desde el mail de confirmación: canjea el código por la sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const to = new URL("/cuenta", url.origin);
  if (isDemo || !code || code.length > 200) return NextResponse.redirect(new URL("/cuenta/ingresar", url.origin));
  const sb = await sessionClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    const fail = new URL("/cuenta/ingresar", url.origin);
    fail.searchParams.set("error", "enlace");
    return NextResponse.redirect(fail);
  }
  to.searchParams.set("bienvenida", "1");
  return NextResponse.redirect(to);
}

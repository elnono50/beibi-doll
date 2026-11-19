import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo } from "@/lib/config";
import { clientIp, limit, sameOrigin } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el email").max(200),
  name: z.string().trim().max(120).optional().default(""),
  consent: z.literal(true, { message: "Tenés que aceptar para suscribirte" }),
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!(await limit(`news:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Hiciste muchos intentos. Probá más tarde." }, { status: 429 });
  }
  let json: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 2000) throw new Error();
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (!(await verifyTurnstile((json as { cf_token?: unknown } | null)?.cf_token, clientIp(req)))) {
    return NextResponse.json({ error: "No pudimos verificar que seas una persona. Recargá la página e intentá de nuevo." }, { status: 403 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos" }, { status: 422 });
  }
  if (isDemo) return NextResponse.json({ ok: true });
  const { error } = await serviceClient().rpc("subscribe", {
    p_email: parsed.data.email,
    p_name: parsed.data.name,
    p_source: "web",
  });
  if (error) {
    console.error("subscribe", error.message);
    return NextResponse.json({ error: "No pudimos suscribirte. Intentá de nuevo." }, { status: 500 });
  }
  // Misma respuesta exista o no el email: no revela quién está suscripta
  return NextResponse.json({ ok: true });
}

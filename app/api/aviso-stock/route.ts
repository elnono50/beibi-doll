import { NextResponse } from "next/server";
import { z } from "zod";
import { isDemo } from "@/lib/config";
import { clientIp, limit, sameOrigin } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { serviceClient } from "@/lib/supabase/service";
import { variantIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el email").max(200),
  variant_id: variantIdSchema,
  newsletter: z.boolean().optional().default(false),
  website: z.string().max(0).optional(),
});

const MSG: Record<string, [number, string]> = {
  ok: [200, "Listo. Te escribimos apenas vuelva."],
  hay_stock: [409, "¡Ya está disponible! Recargá la página para comprarlo."],
  no_existe: [404, "Ese producto ya no está a la venta."],
  demasiados: [429, "Ya tenés muchos avisos pendientes. Te escribimos con esos primero."],
};

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!(await limit(`alert:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Hiciste muchos intentos. Probá más tarde." }, { status: 429 });
  }
  let json: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 1000) throw new Error();
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (!(await verifyTurnstile((json as { cf_token?: unknown } | null)?.cf_token, clientIp(req)))) {
    return NextResponse.json({ error: "No pudimos verificar que seas una persona. Recargá la página e intentá de nuevo." }, { status: 403 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos" }, { status: 422 });
  if (isDemo) return NextResponse.json({ message: MSG.ok[1] });

  const db = serviceClient();
  const { data, error } = await db.rpc("create_stock_alert", { p_email: parsed.data.email, p_variant_id: parsed.data.variant_id });
  if (error) {
    console.error("stock alert", error.message);
    return NextResponse.json({ error: "No pudimos guardar el aviso. Intentá de nuevo." }, { status: 500 });
  }
  if (parsed.data.newsletter) await db.rpc("subscribe", { p_email: parsed.data.email, p_name: "", p_source: "web" });
  const [status, message] = MSG[data as string] ?? MSG.ok;
  return status === 200 ? NextResponse.json({ message }) : NextResponse.json({ error: message }, { status });
}

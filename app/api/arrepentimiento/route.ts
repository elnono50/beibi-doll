import { after, NextResponse } from "next/server";
import { notifyWithdrawal } from "@/lib/email/notify";
import { isDemo } from "@/lib/config";
import { clientIp, rateLimit, sameOrigin } from "@/lib/security";
import { serviceClient } from "@/lib/supabase/service";
import { withdrawalSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!rateLimit(`arrep:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Hiciste muchos intentos. Probá más tarde." }, { status: 429 });
  }
  let json: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 6000) throw new Error();
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  const parsed = withdrawalSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos" }, { status: 422 });
  }
  const { website: _hp, ...data } = parsed.data;
  if (isDemo) return NextResponse.json({ code: "DEMO1234" });
  const { data: row, error } = await serviceClient()
    .from("withdrawal_requests")
    .insert({ ...data, order_number: data.order_number.replace("#", ""), phone: data.phone || null, reason: data.reason || null })
    .select("code")
    .single();
  if (error) {
    console.error("withdrawal", error.message);
    return NextResponse.json({ error: "No pudimos registrar la solicitud. Intentá de nuevo." }, { status: 500 });
  }
  after(() => notifyWithdrawal({ name: data.name, email: data.email, order_number: data.order_number.replace("#", ""), code: row.code }));
  return NextResponse.json({ code: row.code });
}

import { NextResponse } from "next/server";
import { getSettings } from "@/lib/data";
import { clientIp, limit, sameOrigin } from "@/lib/security";
import { quoteShipping } from "@/lib/shipping";
import { quoteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Cotiza el envío para el checkout. El precio final se recalcula al confirmar. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!(await limit(`envio:${clientIp(req)}`, 30, 10 * 60 * 1000))) {
    return NextResponse.json({ error: "Muchas consultas seguidas. Esperá un momento." }, { status: 429 });
  }
  const raw = await req.text();
  if (raw.length > 8000) return NextResponse.json({ error: "Consulta demasiado grande" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  const parsed = quoteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Revisá el código postal y la provincia" }, { status: 422 });

  const s = await getSettings();
  const q = await quoteShipping(s, { zip: parsed.data.zip, province: parsed.data.province }, parsed.data.items);
  return NextResponse.json(q, { headers: { "Cache-Control": "no-store" } });
}

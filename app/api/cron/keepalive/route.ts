import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { safeEqual } from "@/lib/security";
import { notifyStockBack } from "@/lib/email/notify";
import { publicClient } from "@/lib/supabase/public";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Lo llama Vercel una vez por día (vercel.json). Una consulta liviana mantiene
 * activo el proyecto gratuito de Supabase, que se pausa tras 7 días sin uso.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (isDemo) return NextResponse.json({ ok: true, demo: true });
  const { error } = await publicClient().from("categories").select("id").limit(1);
  // De paso: liberar reservas vencidas y avisar talles que volvieron por esa liberación
  try {
    await serviceClient().rpc("release_expired_orders");
  } catch {
    /* sin service role */
  }
  await notifyStockBack();
  return NextResponse.json({ ok: !error });
}

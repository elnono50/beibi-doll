import { NextResponse } from "next/server";
import { isDemo } from "@/lib/config";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Baja en un clic (List-Unsubscribe-Post, RFC 8058): Gmail y Yahoo la exigen para envíos masivos. */
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!isDemo && /^[0-9a-f]{48}$/.test(t)) {
    await serviceClient().rpc("unsubscribe", { p_token: t });
  }
  return new NextResponse(null, { status: 204 });
}

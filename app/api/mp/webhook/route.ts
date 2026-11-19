import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { alertAdmin } from "@/lib/email/alert";
import { notifyOrder } from "@/lib/email/notify";
import { getPayment, paymentMatches, verifyWebhookSignature } from "@/lib/mercadopago";
import { serviceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    /* MP a veces manda cuerpo vacío; usamos la query */
  }
  const type = url.searchParams.get("type") ?? body.type;
  const dataId = String(url.searchParams.get("data.id") ?? body.data?.id ?? "");

  if (!verifyWebhookSignature(req, dataId)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  const payment = await getPayment(dataId);
  if (!payment || !payment.external_reference) return NextResponse.json({ ok: true });

  const db = serviceClient();
  const { data: order } = await db
    .from("orders")
    .select("id,total,status")
    .eq("id", payment.external_reference)
    .maybeSingle();
  if (!order) return NextResponse.json({ ok: true });

  if (paymentMatches(payment, order)) {
    const { data: result, error } = await db.rpc("mark_order_paid", {
      p_order_id: order.id,
      p_payment_id: String(payment.id),
      p_amount: payment.transaction_amount,
    });
    if (error) {
      console.error("mark_order_paid", error.message);
      after(() => alertAdmin("mark_order_paid", "Un pago aprobado no se pudo registrar (Mercado Pago lo reintenta)", error.message));
      return NextResponse.json({ error: "reintentar" }, { status: 500 }); // MP reintenta
    }
    if (result === "ok") {
      revalidatePath("/admin", "layout");
      after(() => notifyOrder(order.id, "paid"));
    }
  } else if (payment.status === "approved") {
    // Pago aprobado que no coincide con el pedido (monto o moneda): posible intento de fraude
    after(() =>
      alertAdmin(
        "mp_mismatch",
        "Llegó un pago aprobado que no coincide con el pedido. No se marcó como pagado: revisalo en Mercado Pago.",
        { pedido: order.id, pago: payment.id, monto: payment.transaction_amount, total: order.total },
      ),
    );
  } else if (payment.status === "rejected" || payment.status === "cancelled") {
    await db.from("orders").update({ mp_status: payment.status }).eq("id", order.id).eq("status", "pending");
  }
  return NextResponse.json({ ok: true });
}

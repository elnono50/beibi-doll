import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { notifyOrder } from "@/lib/email/notify";
import { isDemo } from "@/lib/config";
import { getSettings } from "@/lib/data";
import { createPreference, mpEnabled } from "@/lib/mercadopago";
import { quoteShipping } from "@/lib/shipping";
import { clientIp, rateLimit, sameOrigin } from "@/lib/security";
import { serviceClient } from "@/lib/supabase/service";
import { sessionClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  pago_no_disponible: "Ese medio de pago no está disponible ahora. Elegí otro.",
  retiro_no_disponible: "El retiro no está disponible ahora. Elegí envío.",
  efectivo_solo_retiro: "El pago en efectivo es sólo para retiro.",
  carrito_invalido: "Tu bolsa tiene un problema. Vaciála y volvé a agregar los productos.",
  producto_no_disponible: "Uno de los productos ya no está a la venta. Quitalo de tu bolsa para seguir.",
  talle_invalido: "Uno de los talles elegidos ya no existe. Quitá ese producto y volvé a agregarlo.",
  variante_invalida: "Una de las opciones elegidas ya no está disponible. Revisá tu bolsa.",
  zona_invalida: "Elegí cómo te lo enviamos.",
  falta_sucursal: "Contanos en qué sucursal lo retirás.",
  cantidad_invalida: "Revisá las cantidades de tu bolsa.",
  demasiados_pendientes:
    "Ya tenés pedidos esperando el pago. Completá uno de esos (está en el mail o en tu cuenta) o esperá a que venzan.",
  demasiadas_unidades: "Podés llevar hasta 12 prendas por pedido. Si necesitás más, escribinos.",
};

function friendly(message: string) {
  const m = message.match(/sin_stock:(.+)$/);
  if (m) return `No queda stock suficiente de ${m[1].trim()} en el color y talle elegidos. Bajá la cantidad o elegí otro.`;
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "No pudimos crear el pedido. Intentá de nuevo en unos minutos.";
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 415 });
  }
  if (!rateLimit(`checkout:${clientIp(req)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Hiciste muchos intentos seguidos. Esperá unos minutos." }, { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > 20_000) return NextResponse.json({ error: "Pedido demasiado grande" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(json);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path.join(".");
      if (k === "website") return NextResponse.json({ error: "No pudimos procesar el pedido." }, { status: 400 });
      if (!fields[k]) fields[k] = issue.message;
    }
    return NextResponse.json({ error: "Revisá los datos marcados.", fields }, { status: 422 });
  }
  const input = parsed.data;

  if (isDemo) {
    return NextResponse.json({ redirect: `/pedido/demo?pago=${input.payment_method}` });
  }

  if (input.payment_method === "mercadopago" && !mpEnabled()) {
    return NextResponse.json({ error: "Mercado Pago no está disponible ahora. Elegí transferencia." }, { status: 400 });
  }

  // El envío se vuelve a cotizar acá: nunca se usa un precio que venga del navegador
  let shipping: Record<string, unknown> = { method: "pickup" };
  if (input.shipping_method === "delivery") {
    const s = await getSettings();
    const q = await quoteShipping(s, { zip: input.address!.zip, province: input.address!.province }, input.items);
    const chosen = q.options.find((o) => o.id === input.shipping_option);
    if (!chosen) {
      return NextResponse.json(
        {
          error: "El costo de envío se actualizó. Elegí de nuevo cómo te lo enviamos.",
          fields: { shipping_option: "Elegí de nuevo" },
          shipping: q,
        },
        { status: 409 },
      );
    }
    if (chosen.needs_branch && input.shipping_branch.trim().length < 3) {
      return NextResponse.json(
        { error: "Revisá los datos marcados.", fields: { shipping_branch: "Contanos en qué sucursal lo retirás" } },
        { status: 422 },
      );
    }
    shipping = {
      method: "delivery",
      option: chosen.id,
      price: chosen.price,
      label: chosen.label,
      eta: chosen.detail,
      branch: chosen.needs_branch ? input.shipping_branch : "",
    };
  }

  const db = serviceClient();
  const { website: _hp, newsletter, shipping_method: _sm, shipping_option: _so, shipping_branch: _sb, ...rest } = input;
  const payload = { ...rest, shipping };
  const { data, error } = await db.rpc("create_order", { p: payload });
  if (error || !data) {
    console.error("create_order", error?.message);
    return NextResponse.json({ error: friendly(error?.message ?? "") }, { status: 409 });
  }

  const order = data as {
    id: string;
    number: number;
    access_token: string;
    total: number;
    discount: number;
    shipping_cost: number;
    reserved_until: string;
    items: { id: string; title: string; quantity: number; unit_price: number }[];
  };

  // Si compró con sesión iniciada, el pedido queda en su cuenta
  try {
    const sb = await sessionClient();
    const { data: auth } = await sb.auth.getUser();
    if (auth.user) await db.rpc("link_order_to_user", { p_order_id: order.id, p_user_id: auth.user.id });
  } catch {
    /* sin sesión: pedido como invitada */
  }
  if (newsletter) {
    await db.rpc("subscribe", { p_email: input.email, p_name: input.customer_name, p_source: "checkout" });
  }

  // El stock cambió: refrescamos las páginas de esos productos
  revalidatePath("/tienda");
  revalidatePath("/producto/[slug]", "page");

  const orderUrl = `/pedido/${order.id}?t=${order.access_token}`;

  if (input.payment_method !== "mercadopago") {
    after(() => notifyOrder(order.id, "created"));
    return NextResponse.json({ redirect: orderUrl });
  }

  try {
    const pref = await createPreference({
      orderId: order.id,
      orderNumber: order.number,
      accessToken: order.access_token,
      items: order.items,
      discount: order.discount,
      shipping: order.shipping_cost,
      total: order.total,
      payer: { name: input.customer_name, email: input.email },
      expiresAt: new Date(order.reserved_until).toISOString(),
    });
    await db.from("orders").update({ mp_preference_id: pref.id }).eq("id", order.id);
    return NextResponse.json({ redirect: pref.init_point });
  } catch (e) {
    console.error("mp preference", (e as Error).message);
    await db.rpc("system_cancel_order", { p_order_id: order.id });
    return NextResponse.json(
      { error: "Mercado Pago no respondió. No se cobró nada: probá de nuevo o elegí transferencia." },
      { status: 502 },
    );
  }
}

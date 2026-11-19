"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyOrder, notifyStockBack } from "@/lib/email/notify";
import { adminRecipients, emailEnabled, sendMail } from "@/lib/email/send";
import { nowAR } from "@/lib/email/alert";
import { sendCampaignChunk } from "@/lib/email/campaign";
import { toEmailProducts } from "@/lib/email/products";
import { adminPaymentsChanged, newsletter } from "@/lib/email/templates";
import { getSettings, normalizeProduct, PRODUCT_SELECT } from "@/lib/data";
import type { Product, Settings } from "@/lib/types";
import { z } from "zod";
import { DemoError, requireAdmin } from "@/lib/auth";
import { isDemo, SITE_URL as SITE, SUPABASE_URL } from "@/lib/config";
import { PROVINCES } from "@/lib/format";
import { mergeSettings } from "@/lib/defaults";
import { sessionClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true; id?: string; sent?: number; notice?: string } | { ok: false; error: string };

const allowedHosts = () => {
  const hosts = ["images.unsplash.com"];
  if (SUPABASE_URL) hosts.push(new URL(SUPABASE_URL).host);
  return hosts;
};
const imageUrl = z
  .string()
  .url()
  .max(600)
  .refine((u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" && allowedHosts().includes(x.host);
    } catch {
      return false;
    }
  }, "La imagen tiene que estar subida desde el panel");
const optionalImage = z.union([imageUrl, z.literal("")]);
const money = z.number().int().min(0).max(100_000_000);
const shortText = (max: number) => z.string().trim().max(max);
const internalHref = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/(?!\/)[\w\-/?=&%.]*$/, "El enlace tiene que ser una página de la tienda (empieza con /)");

async function run(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    if (e instanceof DemoError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) {
      const i = e.issues[0];
      return { ok: false, error: `${i.message}${i.path.length ? ` (${i.path.join(" › ")})` : ""}` };
    }
    const msg = (e as Error).message ?? "";
    if (msg.includes("products_slug_key")) return { ok: false, error: "Ya hay otro producto con esa dirección web. Cambiala." };
    if (msg.includes("categories_slug_key")) return { ok: false, error: "Ya hay otra línea con esa dirección web." };
    if (msg.includes("product_variants_product_id_color_size_key"))
      return { ok: false, error: "Hay un talle repetido en el mismo color." };
    if (msg.includes("sin_stock")) return { ok: false, error: "No hay stock suficiente para reactivar este pedido." };
    if (msg.includes("ya_enviado")) return { ok: false, error: "No se puede cancelar un pedido que ya se envió." };
    console.error("admin action", msg);
    return { ok: false, error: msg.length < 140 ? msg : "No se pudo guardar. Intentá de nuevo." };
  }
}

const refresh = () => revalidatePath("/", "layout");

/* ---------------------------- Productos ---------------------------- */

const colorName = z.string().trim().max(40);
const variantSchema = z.object({
  id: z.string().uuid().optional(),
  color: colorName,
  size: z.string().trim().min(1, "Falta el talle").max(12),
  stock: z.number().int().min(0).max(100000),
  stock_was: z.number().int().min(0).max(100000).optional(),
  sort: z.number().int().min(0).max(1000),
});
const imageSchema = z.object({
  id: z.string().uuid().optional(),
  url: imageUrl,
  path: z.string().max(300).optional().nullable(),
  alt: shortText(200),
  color: colorName.nullable().optional(),
  sort: z.number().int().min(0).max(1000),
});
const productColorSchema = z.object({
  name: z.string().trim().min(1, "Poné el nombre del color").max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
});
const productSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Poné un nombre").max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "La dirección web sólo puede tener minúsculas, números y guiones")
      .max(90),
    category_id: z.string().uuid().nullable(),
    price: money,
    compare_at_price: money.nullable(),
    colors: z.array(productColorSchema).max(20),
    weight_g: z.number().int().min(1, "Poné el peso en gramos").max(25000),
    description: shortText(4000),
    details: shortText(4000),
    care: shortText(2000),
    featured: z.boolean(),
    active: z.boolean(),
    sort: z.number().int().min(0).max(10000),
    variants: z.array(variantSchema).max(200),
    images: z.array(imageSchema).max(12),
  })
  .superRefine((p, ctx) => {
    const names = p.colors.map((c) => c.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Hay colores repetidos", path: ["colors"] });
    const known = new Set(p.colors.map((c) => c.name));
    if (p.colors.length && p.variants.some((v) => !known.has(v.color))) {
      ctx.addIssue({ code: "custom", message: "Hay talles cargados para un color que ya no existe", path: ["variants"] });
    }
    if (!p.colors.length && p.variants.some((v) => v.color)) {
      ctx.addIssue({ code: "custom", message: "Hay talles con color pero el producto no tiene colores", path: ["variants"] });
    }
    const keys = p.variants.map((v) => `${v.color}:${v.size.toUpperCase()}`);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Hay un talle repetido en el mismo color", path: ["variants"] });
    if (p.compare_at_price != null && p.compare_at_price <= p.price) {
      ctx.addIssue({ code: "custom", message: "El precio anterior tiene que ser mayor que el actual", path: ["compare_at_price"] });
    }
    if (p.active && p.variants.length === 0) {
      ctx.addIssue({ code: "custom", message: "Agregá al menos un talle antes de publicarlo", path: ["variants"] });
    }
  });
export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    const p = productSchema.parse(input);
    // Fotos marcadas con un color que ya no existe pasan a ser de todos los colores
    const known = new Set(p.colors.map((c) => c.name));
    for (const img of p.images) if (img.color && !known.has(img.color)) img.color = null;
    // Fotos que se quitan: las borramos también del almacenamiento
    let removedPaths: string[] = [];
    if (p.id) {
      const { data: prev } = await db.from("product_images").select("id,path").eq("product_id", p.id);
      const keep = new Set(p.images.map((i) => i.id).filter(Boolean));
      removedPaths = (prev ?? []).filter((i) => !keep.has(i.id) && i.path).map((i) => i.path as string);
    }
    const { data, error } = await db.rpc("admin_save_product", { p });
    if (error) throw new Error(error.message);
    if (removedPaths.length) await db.storage.from("media").remove(removedPaths);
    refresh();
    after(() => notifyStockBack());
    return { ok: true, id: data as string };
  });
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const r = await run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const { data: imgs } = await db.from("product_images").select("path").eq("product_id", id);
    const { error } = await db.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    const paths = (imgs ?? []).map((i) => i.path).filter(Boolean) as string[];
    if (paths.length) await db.storage.from("media").remove(paths);
    refresh();
  });
  if (r.ok) redirect("/admin/productos");
  return r;
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const { error } = await db.from("products").update({ active }).eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

const stockSchema = z
  .array(z.object({ id: z.string().uuid(), delta: z.number().int().min(-100000).max(100000) }))
  .max(2000);

/** Recibe diferencias (+3, −1) para no pisar ventas que entren mientras se edita. */
export async function saveStock(updates: { id: string; delta: number }[]): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    const list = stockSchema.parse(updates).filter((u) => u.delta !== 0);
    if (!list.length) return;
    const { error } = await db.rpc("admin_adjust_stock", { p: list });
    if (error) throw new Error(error.message);
    refresh();
    after(() => notifyStockBack());
  });
}

/* ----------------------------- Líneas ------------------------------ */

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Dirección web inválida").max(60),
  description: shortText(400),
  image_url: optionalImage,
  sort: z.number().int().min(0).max(100),
  active: z.boolean(),
});
export type CategoryInput = z.input<typeof categorySchema>;

export async function saveCategories(list: CategoryInput[]): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    const cats = z.array(categorySchema).max(20).parse(list);
    for (const c of cats) {
      const row = { ...c, image_url: c.image_url || null };
      const { error } = c.id
        ? await db.from("categories").update(row).eq("id", c.id)
        : await db.from("categories").insert(row);
      if (error) throw new Error(error.message);
    }
    refresh();
  });
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const { error } = await db.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);
    refresh();
  });
}

/* ----------------------------- Ajustes ----------------------------- */

const heroSchema = z.object({
  id: z.string().max(40),
  image: imageUrl,
  image_alt: shortText(200),
  title: z.string().trim().min(1, "Cada imagen del inicio necesita un título").max(80),
  text: shortText(240),
  cta_label: shortText(40),
  cta_href: internalHref,
});

const settingsSchema = z.object({
  hero: z.array(heroSchema).min(1, "Dejá al menos una imagen en el inicio").max(5),
  announcements: z.array(shortText(90)).max(4),
  editorial: z.object({ image: optionalImage, image_alt: shortText(200), title: shortText(80), text: shortText(600) }),
  shipping: z.object({
    zones: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9-]{1,40}$/),
          label: z.string().trim().min(1).max(60),
          detail: shortText(120),
          price: money,
          enabled: z.boolean(),
          provinces: z.array(z.enum(PROVINCES as [string, ...string[]])).max(24),
          tiers: z
            .array(z.object({ max_g: z.number().int().min(1).max(100000), price: money }))
            .max(10),
          branch: z.boolean(),
        }),
      )
      .max(20),
    free_from: money.nullable(),
    eta: shortText(200),
    pickup: z.object({ enabled: z.boolean(), address: shortText(200), hours: shortText(120) }),
    carrier: z.object({
      enabled: z.boolean(),
      origin_zip: z.string().trim().regex(/^\d{4}$/, "El código postal de origen tiene 4 números"),
      home: z.boolean(),
      branch: z.boolean(),
      package: z.object({
        length: z.number().int().min(1).max(150),
        width: z.number().int().min(1).max(150),
        height: z.number().int().min(1).max(150),
      }),
      extra: money,
    }),
  }),
  payments: z.object({
    mercadopago: z.object({ enabled: z.boolean() }),
    transfer: z.object({
      enabled: z.boolean(),
      discount_pct: z.number().min(0).max(50),
      holder: shortText(120),
      bank: shortText(80),
      cbu: z.string().trim().regex(/^(\d{22})?$/, "El CBU/CVU tiene 22 números"),
      alias: z.string().trim().regex(/^([a-zA-Z0-9.-]{6,20})?$/, "El alias tiene entre 6 y 20 caracteres"),
      cuit: shortText(20),
    }),
    cash: z.object({ enabled: z.boolean() }),
  }),
  contact: z.object({
    whatsapp: z.string().trim().regex(/^(\d{10,15})?$/, "WhatsApp: sólo números con código de país, ej. 5491122334455"),
    instagram: z.string().trim().regex(/^([a-zA-Z0-9._]{1,30})?$/, "Instagram: sólo el usuario, sin @"),
    email: z.union([z.string().trim().email("Email inválido").max(200), z.literal("")]),
    city: shortText(80),
  }),
  legal: z.object({
    business_name: shortText(120),
    cuit: shortText(20),
    data_fiscal_url: z.union([
      z.string().url().max(400).refine((u) => u.startsWith("https://"), "Tiene que empezar con https://"),
      z.literal(""),
    ]),
  }),
  size_guide: z
    .array(z.object({ size: z.string().trim().min(1).max(12), busto: shortText(20), cintura: shortText(20), cadera: shortText(20) }))
    .max(12),
  tagline: shortText(120),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export async function saveSettings(partial: Partial<SettingsInput>): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    const { data: row } = await db.from("settings").select("data").eq("id", 1).maybeSingle();
    const merged = { ...mergeSettings(row?.data), ...partial };
    const valid = settingsSchema.parse(merged);
    if (!valid.payments.mercadopago.enabled && !valid.payments.transfer.enabled && !valid.payments.cash.enabled) {
      return { ok: false, error: "Dejá activo al menos un medio de pago." };
    }
    const { error } = await db.from("settings").update({ data: valid }).eq("id", 1);
    if (error) throw new Error(error.message);
    const changes = paymentChanges(mergeSettings(row?.data).payments, valid.payments as Settings["payments"]);
    if (changes.length) {
      const { data: auth } = await db.auth.getUser();
      after(() => notifyPaymentsChanged(auth.user?.email ?? "", changes));
    }
    refresh();
  });
}

/** Diferencias en los datos con los que se cobra (lo que un atacante querría cambiar). */
function paymentChanges(a: Settings["payments"], b: Settings["payments"]): [string, string, string][] {
  const out: [string, string, string][] = [];
  const t = (x: string, y: string, label: string) => {
    if ((x ?? "").trim() !== (y ?? "").trim()) out.push([label, x ?? "", y ?? ""]);
  };
  const on = (v: boolean) => (v ? "Activo" : "Apagado");
  t(a.transfer.alias, b.transfer.alias, "Alias");
  t(a.transfer.cbu, b.transfer.cbu, "CBU / CVU");
  t(a.transfer.holder, b.transfer.holder, "Titular");
  t(a.transfer.bank, b.transfer.bank, "Banco");
  t(a.transfer.cuit, b.transfer.cuit, "CUIT");
  t(on(a.transfer.enabled), on(b.transfer.enabled), "Transferencia");
  t(on(a.mercadopago.enabled), on(b.mercadopago.enabled), "Mercado Pago");
  t(on(a.cash.enabled), on(b.cash.enabled), "Efectivo");
  return out;
}

async function notifyPaymentsChanged(by: string, changes: [string, string, string][]) {
  try {
    if (!emailEnabled()) return;
    const to = [...new Set([by, ...adminRecipients()].filter(Boolean))];
    if (!to.length) return;
    const settings = await getSettings();
    const m = adminPaymentsChanged({ by: by || "una administradora", at: nowAR(), changes }, settings);
    await sendMail({ to, ...m });
  } catch (e) {
    console.error("payments alert", (e as Error).message);
  }
}

/* ----------------------------- Pedidos ----------------------------- */

const statusSchema = z.enum(["paid", "preparing", "shipped", "delivered", "cancelled"]);

export async function setOrderStatus(id: string, status: string): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const s = statusSchema.parse(status);
    const { data: result, error } = await db.rpc("admin_set_order_status", { p_order_id: id, p_status: s });
    if (error) throw new Error(error.message);
    if (result === "ok") {
      // "preparing" en un pedido con retiro = "Listo para retirar" (el mail sólo sale si es retiro)
      const event =
        s === "paid"
          ? "paid"
          : s === "preparing"
            ? "ready"
            : s === "shipped"
              ? "shipped"
              : s === "delivered"
                ? "delivered"
                : s === "cancelled"
                  ? "cancelled"
                  : null;
      if (event) after(() => notifyOrder(id, event));
      if (event === "cancelled") after(() => notifyStockBack());
    }
    revalidatePath("/admin", "layout");
    revalidatePath("/tienda");
    revalidatePath("/producto/[slug]", "page");
  });
}

export async function saveOrderMeta(id: string, tracking_code: string, admin_notes: string): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const t = shortText(120).parse(tracking_code);
    const n = shortText(2000).parse(admin_notes);
    const { error } = await db
      .from("orders")
      .update({ tracking_code: t || null, admin_notes: n || null })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
  });
}

export async function setWithdrawalHandled(id: string, handled: boolean): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    z.string().uuid().parse(id);
    const { error } = await db.from("withdrawal_requests").update({ handled }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin", "layout");
  });
}

export async function signOut() {
  if (isDemo) redirect("/admin");
  const db = await sessionClient();
  await db.auth.signOut();
  redirect("/admin/login");
}

/* ----------------------------- Novedades ----------------------------- */

const campaignSchema = z.object({
  kind: z.enum(["libre", "nuevos", "stock"]).default("libre"),
  product_ids: z.array(z.string().uuid()).max(8).default([]),
  subject: z.string().trim().min(3, "Escribí el asunto").max(150),
  preheader: shortText(150),
  title: z.string().trim().min(2, "Escribí un título").max(120),
  text: z.string().trim().min(10, "Escribí el texto del mail").max(5000),
  image: optionalImage,
  image_alt: shortText(200),
  cta_label: shortText(40),
  cta_url: z.union([
    z
      .string()
      .trim()
      .url("El enlace del botón no es válido")
      .max(400)
      .refine((u) => u.startsWith("https://"), "El enlace tiene que empezar con https://"),
    z.literal(""),
  ]),
});
export type CampaignInput = z.input<typeof campaignSchema>;

export async function sendNewsletter(input: CampaignInput, mode: "test" | "all"): Promise<ActionResult> {
  return run(async () => {
    const db = await requireAdmin();
    if (!emailEnabled()) return { ok: false, error: "Los envíos de mail todavía no están activos." };
    const c = campaignSchema.parse(input);
    if (c.cta_label && !c.cta_url) return { ok: false, error: "Pusiste texto en el botón pero falta el enlace." };
    const { data: auth } = await db.auth.getUser();
    const settings = mergeSettings((await db.from("settings").select("data").eq("id", 1).maybeSingle()).data?.data);
    // Tarjetas de producto armadas con los datos reales (precio y talles de este momento)
    let products: ReturnType<typeof toEmailProducts> = [];
    if (c.product_ids.length) {
      const { data: rows } = await db.from("products").select(PRODUCT_SELECT).in("id", c.product_ids).eq("active", true);
      const byId = new Map(((rows ?? []) as Product[]).map((r) => [r.id, normalizeProduct(r)]));
      const ordered = c.product_ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
      products = toEmailProducts(ordered, c.kind, SITE);
    }
    if (c.kind !== "libre" && !products.length) return { ok: false, error: "Elegí al menos un producto para este tipo de mail." };
    const content = { ...c, products };

    if (mode === "test") {
      const email = auth.user?.email;
      if (!email) return { ok: false, error: "No encontramos tu email." };
      const m = newsletter(content, settings, `${SITE}/baja`);
      const ok = await sendMail({ to: email, ...m, subject: `[Prueba] ${m.subject}` });
      return ok ? { ok: true, sent: 1 } : { ok: false, error: "No se pudo enviar la prueba. Intentá de nuevo en unos minutos." };
    }

    const { count, error } = await db
      .from("subscribers")
      .select("id", { count: "exact", head: true })
      .is("unsubscribed_at", null);
    if (error) throw new Error(error.message);
    if (!count) return { ok: false, error: "Todavía no hay suscriptas activas." };

    const { data: camp, error: cErr } = await db
      .from("email_campaigns")
      .insert({ subject: c.subject, title: c.title, content: c, recipients: count, created_by: auth.user?.id, status: "sending" })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);

    // Se manda lo que permite el cupo de hoy; el resto sale solo los días siguientes
    let sent = 0;
    let last: Awaited<ReturnType<typeof sendCampaignChunk>> | null = null;
    for (let i = 0; i < 20; i++) {
      last = await sendCampaignChunk(db, camp.id);
      sent += last.sent;
      if (last.done || last.waiting || last.error || last.sent === 0) break;
    }
    revalidatePath("/admin/novedades");
    if (last?.error) return { ok: false, error: `Se enviaron ${sent} de ${count}. ${last.error}` };
    if (last && !last.done) {
      return {
        ok: true,
        sent,
        notice: `Salieron ${sent} de ${count} hoy. El plan de mails permite una cantidad por día: el resto sale solo en los próximos días.`,
      };
    }
    return { ok: true, sent };
  });
}

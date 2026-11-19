import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "../config";
import { normalizeProduct, PRODUCT_SELECT } from "../data";
import { mergeSettings } from "../defaults";
import type { Product, Settings } from "../types";
import { toEmailProducts } from "./products";
import { sendBatch, takeBulkQuota, type Mail } from "./send";
import { newsletter, type Campaign } from "./templates";

/** Contenido guardado de una campaña (lo que escribió la administradora). */
export type CampaignContent = Omit<Campaign, "products"> & { product_ids: string[] };

const CHUNK = 500;

/** Arma las tarjetas de producto con precio y talles del momento del envío. */
export async function withProducts(db: SupabaseClient, c: CampaignContent): Promise<Campaign> {
  let products: ReturnType<typeof toEmailProducts> = [];
  if (c.product_ids?.length) {
    const { data: rows } = await db.from("products").select(PRODUCT_SELECT).in("id", c.product_ids).eq("active", true);
    const byId = new Map(((rows ?? []) as Product[]).map((r) => [r.id, normalizeProduct(r)]));
    const ordered = c.product_ids.map((id) => byId.get(id)).filter(Boolean) as Product[];
    products = toEmailProducts(ordered, c.kind ?? "libre", SITE_URL);
  }
  return { ...c, products };
}

function mailsFor(subs: { email: string; unsubscribe_token: string }[], content: Campaign, settings: Settings): Mail[] {
  return subs.map((sub) => ({
    to: sub.email,
    ...newsletter(content, settings, `${SITE_URL}/baja?t=${sub.unsubscribe_token}`),
    headers: {
      "List-Unsubscribe": `<${SITE_URL}/api/baja?t=${sub.unsubscribe_token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }));
}

export type ChunkResult = { sent: number; done: boolean; waiting: boolean; error?: string };

/**
 * Manda la siguiente tanda de una campaña respetando el cupo diario.
 * Lo que no entra hoy queda en "sending" y lo retoma el cron de mañana.
 * Las suscriptas se recorren por id: nadie recibe el mismo mail dos veces.
 */
export async function sendCampaignChunk(db: SupabaseClient, campaignId: string): Promise<ChunkResult> {
  const { data: camp, error } = await db
    .from("email_campaigns")
    .select("id, content, sent, status, last_sub_id")
    .eq("id", campaignId)
    .single();
  if (error || !camp) throw new Error(error?.message ?? "campaña inexistente");
  if (camp.status !== "sending") return { sent: 0, done: true, waiting: false };

  let q = db.from("subscribers").select("id, email, unsubscribe_token").is("unsubscribed_at", null).order("id").limit(CHUNK);
  if (camp.last_sub_id) q = q.gt("id", camp.last_sub_id);
  const { data: subs, error: sErr } = await q;
  if (sErr) throw new Error(sErr.message);

  if (!subs?.length) {
    await db.from("email_campaigns").update({ status: "done", error: null, updated_at: new Date().toISOString() }).eq("id", camp.id);
    return { sent: 0, done: true, waiting: false };
  }

  const granted = await takeBulkQuota(subs.length);
  if (granted < 1) return { sent: 0, done: false, waiting: true };

  const batch = subs.slice(0, granted);
  const settings = mergeSettings((await db.from("settings").select("data").eq("id", 1).maybeSingle()).data?.data);
  const content = await withProducts(db, camp.content as CampaignContent);
  const res = await sendBatch(mailsFor(batch, content, settings), `campaign-${camp.id}-${batch[0].id}`);

  const last = res.sent > 0 ? batch[res.sent - 1].id : camp.last_sub_id;
  const finished = !res.error && res.sent === batch.length && subs.length < CHUNK && granted === subs.length;
  await db
    .from("email_campaigns")
    .update({
      sent: (camp.sent ?? 0) + res.sent,
      last_sub_id: last,
      status: finished ? "done" : "sending",
      error: res.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", camp.id);
  return { sent: res.sent, done: finished, waiting: !finished && !res.error, error: res.error };
}

/** Sigue con todas las campañas pendientes (lo llama el cron diario). */
export async function resumeCampaigns(db: SupabaseClient) {
  const { data } = await db.from("email_campaigns").select("id").eq("status", "sending").order("created_at").limit(10);
  for (const c of data ?? []) {
    // repetimos mientras haya cupo y suscriptas
    for (let i = 0; i < 20; i++) {
      const r = await sendCampaignChunk(db, c.id);
      if (r.done || r.waiting || r.error || r.sent === 0) break;
    }
  }
}

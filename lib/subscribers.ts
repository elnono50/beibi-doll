import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemo } from "./config";

export type Subscriber = {
  id: string;
  email: string;
  name: string;
  source: string;
  consent_at: string;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
};

export async function listSubscribers(db: SupabaseClient | null) {
  if (!db) {
    if (!isDemo) throw new Error("Sin sesión de administradora");
    return { rows: [] as Subscriber[], customers: 0, missing: false };
  }
  const [subs, cust] = await Promise.all([
    db.from("subscribers").select("*").order("consent_at", { ascending: false }).limit(5000),
    db.from("customers").select("user_id", { count: "exact", head: true }),
  ]);
  // Si la migración 0003 no se corrió todavía, la tabla no existe
  const missing = Boolean(subs.error && /relation|does not exist|schema cache/i.test(subs.error.message));
  return { rows: (subs.data ?? []) as Subscriber[], customers: cust.count ?? 0, missing };
}

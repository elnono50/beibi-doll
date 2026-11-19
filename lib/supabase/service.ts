import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../config";

/**
 * Cliente con service_role. SÓLO servidor: crea pedidos y confirma pagos.
 * Nunca exponer esta clave al navegador.
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

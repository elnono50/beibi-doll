import "server-only";
import { isDemo } from "./config";
import { DEMO_PRODUCTS } from "./demo-data";
import { publicClient } from "./supabase/public";
import type { Settings, ShippingOption, ShippingZone } from "./types";

/**
 * Cotización de envíos.
 *
 * 1. Tarifas propias (por ejemplo, la tabla de Vía Cargo): la administradora
 *    carga precios por provincia y por peso. Se calculan solas según la
 *    provincia de la clienta y lo que pesa la compra.
 * 2. Correo Argentino (MiCorreo): si hay credenciales y está activado en el
 *    panel, se suma la cotización en tiempo real a domicilio y a sucursal. Si
 *    la API no responde, se ofrecen sólo las tarifas propias.
 *
 * Todo se calcula en el servidor. El navegador sólo elige una opción y el
 * precio se vuelve a calcular al confirmar el pedido. La misma regla de
 * zonas está en create_order (SQL).
 */

const API = (process.env.CORREO_API_URL || "https://api.correoargentino.com.ar/micorreo/v1").replace(/\/$/, "");
const USER = process.env.CORREO_API_USER ?? "";
const PASS = process.env.CORREO_API_PASSWORD ?? "";
const CUSTOMER = process.env.CORREO_CUSTOMER_ID ?? "";

export const carrierConfigured = () => Boolean(USER && PASS && CUSTOMER);

type Line = { variant_id: string; quantity: number };

/** Peso total en gramos según lo cargado en cada producto. */
async function totalWeight(items: Line[]): Promise<number | null> {
  const ids = [...new Set(items.map((i) => i.variant_id))];
  const weights = new Map<string, number>();
  if (isDemo) {
    for (const p of DEMO_PRODUCTS) for (const v of p.variants) weights.set(v.id, p.weight_g);
  } else {
    const { data, error } = await publicClient()
      .from("product_variants")
      .select("id, product:products(weight_g)")
      .in("id", ids);
    if (error) return null;
    for (const row of (data ?? []) as unknown as { id: string; product: { weight_g: number } | null }[]) {
      if (row.product) weights.set(row.id, row.product.weight_g);
    }
  }
  let grams = 0;
  for (const it of items) {
    const w = weights.get(it.variant_id);
    if (!w) return null; // variante inexistente o producto despublicado
    grams += w * it.quantity;
  }
  return Math.min(25000, Math.max(100, grams + 150)); // + embalaje
}

/* ---------------------------- MiCorreo ---------------------------- */

let token: { value: string; until: number } | null = null;

async function getToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const res = await fetch(`${API}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}` },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`correo token ${res.status}`);
  const j = (await res.json()) as { token?: string; expires?: string };
  if (!j.token) throw new Error("correo token vacío");
  const exp = j.expires ? Date.parse(j.expires.replace(" ", "T")) : NaN;
  token = { value: j.token, until: Number.isFinite(exp) ? exp : Date.now() + 30 * 60_000 };
  return token.value;
}

type Rate = {
  deliveredType: "D" | "S";
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin?: string | number;
  deliveryTimeMax?: string | number;
};

const cache = new Map<string, { at: number; rates: Rate[] }>();

async function correoRates(destZip: string, grams: number, s: Settings): Promise<Rate[]> {
  const pkg = s.shipping.carrier.package;
  const key = `${destZip}:${Math.ceil(grams / 250)}:${s.shipping.carrier.origin_zip}:${pkg.length}x${pkg.width}x${pkg.height}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.rates;

  const body = {
    customerId: CUSTOMER,
    postalCodeOrigin: s.shipping.carrier.origin_zip,
    postalCodeDestination: destZip,
    dimensions: { weight: grams, height: pkg.height, width: pkg.width, length: pkg.length },
  };
  const send = async () =>
    fetch(`${API}/rates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
  let res = await send();
  if (res.status === 401) {
    token = null;
    res = await send();
  }
  if (!res.ok) throw new Error(`correo rates ${res.status}`);
  const j = (await res.json()) as { rates?: Rate[] };
  const rates = (j.rates ?? []).filter(
    (r) => (r.deliveredType === "D" || r.deliveredType === "S") && Number.isFinite(Number(r.price)) && Number(r.price) > 0,
  );
  if (!rates.length) throw new Error("correo sin tarifas");
  cache.set(key, { at: Date.now(), rates });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return rates;
}

function eta(r: Rate) {
  const a = Number(r.deliveryTimeMin);
  const b = Number(r.deliveryTimeMax);
  if (Number.isFinite(a) && Number.isFinite(b) && b > 0) return a === b ? `${b} días hábiles` : `de ${a} a ${b} días hábiles`;
  return "Según destino";
}

/* ------------------------------ Público ----------------------------- */

/** Tarifas que corresponden a una provincia (sin provincias marcadas = todo el país). */
export function zonesFor(s: Settings, province: string): ShippingZone[] {
  return s.shipping.zones.filter((z) => z.enabled && (z.provinces.length === 0 || z.provinces.includes(province)));
}

export function zonePrice(z: ShippingZone, grams: number) {
  const tier = [...z.tiers].sort((a, b) => a.max_g - b.max_g).find((t) => grams <= t.max_g);
  return tier ? tier.price : z.price;
}

/** Código postal de 4 números (de un CPA como J5400ABC se toma 5400). */
export const plainZip = (zip: string) => zip.replace(/\D/g, "").slice(0, 4);

export async function quoteShipping(
  s: Settings,
  dest: { zip: string; province: string },
  items: Line[],
): Promise<{ options: ShippingOption[] }> {
  const grams = await totalWeight(items);
  if (!grams) return { options: [] };

  const options: ShippingOption[] = zonesFor(s, dest.province).map((z) => ({
    id: `zona:${z.id}`,
    label: z.label,
    detail: z.detail,
    price: zonePrice(z, grams),
    needs_branch: z.branch || undefined,
  }));

  const c = s.shipping.carrier;
  const zip = plainZip(dest.zip);
  if (c.enabled && carrierConfigured() && zip.length === 4 && (c.home || c.branch)) {
    try {
      const rates = await correoRates(zip, grams, s);
      const extra = Math.max(0, Math.round(c.extra || 0));
      const best = (t: "D" | "S") =>
        rates.filter((r) => r.deliveredType === t).sort((a, b) => Number(a.price) - Number(b.price))[0];
      const d = c.home ? best("D") : undefined;
      const b = c.branch ? best("S") : undefined;
      if (d)
        options.push({
          id: "correo:D",
          label: "Correo Argentino a domicilio",
          detail: `Llega ${eta(d)}`,
          price: Math.ceil(Number(d.price)) + extra,
        });
      if (b)
        options.push({
          id: "correo:S",
          label: "Correo Argentino a sucursal",
          detail: `Retirás en la sucursal que elijas, ${eta(b)}`,
          price: Math.ceil(Number(b.price)) + extra,
          needs_branch: true,
        });
    } catch (e) {
      console.error("cotizacion correo", (e as Error).message);
    }
  }
  return { options: options.sort((a, b) => a.price - b.price) };
}

import "server-only";
import { variantLabel } from "./stock";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDemo } from "./config";
import { PRODUCT_SELECT, normalizeProduct } from "./data";
import { DEFAULT_SETTINGS, mergeSettings } from "./defaults";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "./demo-data";
import { serviceClient } from "./supabase/service";
import type { Category, Order, OrderItem, Product, Settings } from "./types";

type Db = SupabaseClient | null; // null = vista previa

// Los datos de muestra sólo existen en la vista previa: con la base conectada,
// un cliente nulo es un error de programación y no debe mostrar nada.
function demoOnly(db: Db) {
  if (!db && !isDemo) throw new Error("Acceso al panel sin sesión de administradora");
  return !db;
}

export type Withdrawal = {
  id: string;
  order_number: string;
  name: string;
  email: string;
  phone: string | null;
  reason: string | null;
  code: string;
  handled: boolean;
  created_at: string;
};

const now = Date.now();
const DEMO_ORDERS: (Order & { items: OrderItem[] })[] = [
  {
    id: "00000000-0000-4000-8000-000000001003",
    number: 1003,
    status: "pending",
    payment_method: "transfer",
    customer_name: "Lucía Fernández",
    email: "lucia@ejemplo.com",
    phone: "1155554444",
    dni: "35123456",
    shipping_method: "delivery",
    shipping_zone: "zona:via-cargo-domicilio",
    shipping_zone_label: "Vía Cargo a domicilio",
    shipping_eta: "De 3 a 6 días hábiles",
    shipping_branch: null,
    address: { street: "Av. San Martín", number: "1200", floor: "3 B", city: "Godoy Cruz", province: "Mendoza", zip: "5501" },
    notes: null,
    subtotal: 62800,
    discount: 0,
    shipping_cost: 9900,
    total: 72700,
    stock_reserved: true,
    stock_conflict: false,
    reserved_until: new Date(now + 40 * 3600e3).toISOString(),
    mp_payment_id: null,
    tracking_code: null,
    admin_notes: null,
    paid_at: null,
    created_at: new Date(now - 8 * 3600e3).toISOString(),
    items: [
      { id: "a", product_id: "p-corset-noir", product_name: "Corset Noir", product_slug: "corset-noir", image_url: DEMO_PRODUCTS[0].images[0].url, color: "Negro", size: "M", variant_label: "Negro · Talle M", quantity: 1, unit_price: 32900 },
      { id: "a2", product_id: "p-mini-denim", product_name: "Mini Denim", product_slug: "mini-denim", image_url: DEMO_PRODUCTS[5].images[0].url, color: "Azul gastado", size: "38", variant_label: "Azul gastado · Talle 38", quantity: 1, unit_price: 29900 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000001002",
    number: 1002,
    status: "paid",
    payment_method: "mercadopago",
    customer_name: "Sofía Romero",
    email: "sofi@ejemplo.com",
    phone: "3415556677",
    dni: "38999111",
    shipping_method: "delivery",
    shipping_zone: "zona:via-cargo-sucursal",
    shipping_zone_label: "Vía Cargo a sucursal",
    shipping_eta: "Retirás en la sucursal que elijas, de 3 a 6 días hábiles",
    shipping_branch: "Sucursal Vía Cargo Rosario Centro",
    address: { street: "Bv. Oroño", number: "850", floor: "", city: "Rosario", province: "Santa Fe", zip: "2000" },
    notes: "Si se puede, que venga en bolsa de regalo.",
    subtotal: 104800,
    discount: 0,
    shipping_cost: 8900,
    total: 113700,
    stock_reserved: true,
    stock_conflict: false,
    reserved_until: null,
    mp_payment_id: "1234567890",
    tracking_code: null,
    admin_notes: null,
    paid_at: new Date(now - 26 * 3600e3).toISOString(),
    created_at: new Date(now - 26 * 3600e3).toISOString(),
    items: [
      { id: "b", product_id: "p-vestido-medianoche", product_name: "Vestido Medianoche", product_slug: "vestido-medianoche", image_url: DEMO_PRODUCTS[2].images[0].url, color: "Negro", size: "S", variant_label: "Negro · Talle S", quantity: 1, unit_price: 58900 },
      { id: "c", product_id: "p-baggy-2000", product_name: "Baggy 2000", product_slug: "baggy-2000", image_url: DEMO_PRODUCTS[1].images[0].url, color: "Azul gastado", size: "38", variant_label: "Azul gastado · Talle 38", quantity: 1, unit_price: 45900 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000001001",
    number: 1001,
    status: "shipped",
    payment_method: "mercadopago",
    customer_name: "Martina Gómez",
    email: "martu@ejemplo.com",
    phone: "1144443333",
    dni: null,
    shipping_method: "pickup",
    shipping_zone: null,
    shipping_zone_label: null,
    shipping_eta: null,
    shipping_branch: null,
    address: null,
    notes: null,
    subtotal: 33800,
    discount: 0,
    shipping_cost: 0,
    total: 33800,
    stock_reserved: true,
    stock_conflict: false,
    reserved_until: null,
    mp_payment_id: "1234567000",
    tracking_code: null,
    admin_notes: null,
    paid_at: new Date(now - 72 * 3600e3).toISOString(),
    created_at: new Date(now - 72 * 3600e3).toISOString(),
    items: [
      { id: "d", product_id: "p-baby-tee", product_name: "Baby Tee", product_slug: "baby-tee", image_url: DEMO_PRODUCTS[4].images[0].url, color: "Blanco", size: "M", variant_label: "Blanco · Talle M", quantity: 2, unit_price: 16900 },
    ],
  },
];

export async function releaseExpired(db: Db) {
  if (!db) return;
  try {
    await serviceClient().rpc("release_expired_orders");
  } catch {
    /* sin service role configurado: el cron o el próximo pedido lo hacen */
  }
}

export async function adminProducts(db: Db): Promise<Product[]> {
  if (demoOnly(db)) return DEMO_PRODUCTS.map(normalizeProduct);
  const { data, error } = await db.from("products").select(PRODUCT_SELECT).order("sort").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Product[]).map(normalizeProduct);
}

export async function adminProduct(db: Db, id: string): Promise<Product | null> {
  if (demoOnly(db)) {
    const p = DEMO_PRODUCTS.find((x) => x.id === id);
    return p ? normalizeProduct(p) : null;
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db.from("products").select(PRODUCT_SELECT).eq("id", id).maybeSingle();
  return data ? normalizeProduct(data as Product) : null;
}

export async function adminCategories(db: Db): Promise<Category[]> {
  if (demoOnly(db)) return DEMO_CATEGORIES;
  const { data } = await db.from("categories").select("*").order("sort");
  return (data ?? []) as Category[];
}

export async function adminSettings(db: Db): Promise<Settings> {
  if (demoOnly(db)) return DEFAULT_SETTINGS;
  const { data } = await db.from("settings").select("data").eq("id", 1).maybeSingle();
  return mergeSettings(data?.data);
}

export async function adminOrders(db: Db, status?: string): Promise<Order[]> {
  if (demoOnly(db)) return DEMO_ORDERS.filter((o) => !status || o.status === status);
  let q = db.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data ?? []) as Order[];
}

export async function adminOrder(db: Db, id: string): Promise<(Order & { items: OrderItem[] }) | null> {
  if (demoOnly(db)) return DEMO_ORDERS.find((o) => o.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db.from("orders").select("*, items:order_items(*)").eq("id", id).maybeSingle();
  return (data as Order & { items: OrderItem[] }) ?? null;
}

export async function adminWithdrawals(db: Db): Promise<Withdrawal[]> {
  if (demoOnly(db)) return [];
  const { data } = await db.from("withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as Withdrawal[];
}

export async function adminCounts(db: Db) {
  if (demoOnly(db)) return { toPrepare: 1, pending: 1, withdrawals: 0 };
  const [a, b, c] = await Promise.all([
    db.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "preparing"]),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("handled", false),
  ]);
  return { toPrepare: a.count ?? 0, pending: b.count ?? 0, withdrawals: c.count ?? 0 };
}

export type AlertDemand = { product: string; productId: string; label: string; count: number };

/** Cuántas personas esperan cada talle agotado ("Avisame cuando vuelva"). */
export async function adminStockDemand(db: Db): Promise<AlertDemand[]> {
  if (demoOnly(db)) return [{ product: "Corset Noir", productId: "p-corset-noir", label: "Bordó · Talle S", count: 3 }];
  const { data, error } = await db!
    .from("stock_alerts")
    .select("variant_id, product:products(id, name), variant:product_variants(color, size)")
    .is("notified_at", null)
    .limit(2000);
  if (error) return [];
  const map = new Map<string, AlertDemand>();
  for (const r of (data ?? []) as unknown as {
    variant_id: string;
    product: { id: string; name: string } | null;
    variant: { color: string; size: string } | null;
  }[]) {
    if (!r.product || !r.variant) continue;
    const cur = map.get(r.variant_id) ?? {
      product: r.product.name,
      productId: r.product.id,
      label: variantLabel(r.variant.color, r.variant.size),
      count: 0,
    };
    cur.count += 1;
    map.set(r.variant_id, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

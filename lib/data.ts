import "server-only";
import { cache } from "react";
import { isDemo } from "./config";
import { DEFAULT_SETTINGS, mergeSettings } from "./defaults";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "./demo-data";
import { publicClient } from "./supabase/public";
import type { Category, Product, Settings } from "./types";

export const PRODUCT_SELECT =
  "*, images:product_images(id,url,path,alt,color,sort), variants:product_variants(id,color,size,stock,sort), category:categories(slug,name)";

export function normalizeProduct(p: Product): Product {
  return {
    ...p,
    images: [...(p.images ?? [])].sort((a, b) => a.sort - b.sort),
    colors: Array.isArray(p.colors) ? p.colors : [],
    variants: [...(p.variants ?? [])].sort((a, b) => a.sort - b.sort),
  };
}

export const getSettings = cache(async (): Promise<Settings> => {
  if (isDemo) return DEFAULT_SETTINGS;
  const { data, error } = await publicClient().from("settings").select("data").eq("id", 1).maybeSingle();
  if (error) console.error("settings", error.message);
  const s = mergeSettings(data?.data);
  // Sin credenciales de Mercado Pago no lo ofrecemos aunque esté activado
  if (!process.env.MP_ACCESS_TOKEN) s.payments.mercadopago.enabled = false;
  return s;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  if (isDemo) return DEMO_CATEGORIES;
  const { data, error } = await publicClient()
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort");
  if (error) console.error("categories", error.message);
  return (data ?? []) as Category[];
});

export type ProductSort = "destacados" | "nuevos" | "menor-precio" | "mayor-precio";

export const getProducts = cache(
  async (opts: { category?: string; sort?: ProductSort; featured?: boolean; limit?: number } = {}) => {
    let list: Product[];
    if (isDemo) {
      list = DEMO_PRODUCTS.map(normalizeProduct);
    } else {
      const { data, error } = await publicClient()
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("active", true)
        .order("sort")
        .order("created_at", { ascending: false });
      if (error) console.error("products", error.message);
      list = ((data ?? []) as Product[]).map(normalizeProduct);
    }
    if (opts.category) list = list.filter((p) => p.category?.slug === opts.category);
    if (opts.featured) list = list.filter((p) => p.featured);
    switch (opts.sort) {
      case "nuevos":
        list.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "menor-precio":
        list.sort((a, b) => a.price - b.price);
        break;
      case "mayor-precio":
        list.sort((a, b) => b.price - a.price);
        break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort);
    }
    return opts.limit ? list.slice(0, opts.limit) : list;
  },
);

export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  if (isDemo) {
    const p = DEMO_PRODUCTS.find((x) => x.slug === slug);
    return p ? normalizeProduct(p) : null;
  }
  const { data } = await publicClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return data ? normalizeProduct(data as Product) : null;
});

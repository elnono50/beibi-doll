import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { getCategories, getProducts } from "@/lib/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/tienda`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${SITE_URL}/tienda?categoria=${c.slug}`, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE_URL}/producto/${p.slug}`, priority: 0.7 })),
  ];
}

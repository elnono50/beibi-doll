import type { Product, ProductColor, ProductImage, Variant } from "./types";

export const LOW_STOCK = 2;

/** Stock total disponible (para mostrar "últimas unidades" / "sin stock"). */
export function stockSummary(p: Product) {
  const total = p.variants.reduce((a, v) => a + v.stock, 0);
  return { total, soldOut: total === 0 };
}

/** Colores en el orden que cargó la administradora (sumando los que sólo existen en variantes). */
export function colorsOf(p: Product): ProductColor[] {
  const out: ProductColor[] = [...(p.colors ?? [])].filter((c) => c && c.name);
  for (const v of p.variants) {
    if (v.color && !out.some((c) => c.name === v.color)) out.push({ name: v.color, hex: "#777777" });
  }
  return out.filter((c) => p.variants.some((v) => v.color === c.name));
}

/** Talles en el orden de carga, sin repetir. */
export function sizesOf(p: Product, color?: string): string[] {
  const vs = color === undefined ? p.variants : p.variants.filter((v) => v.color === color);
  return [...new Set([...vs].sort((a, b) => a.sort - b.sort).map((v) => v.size))];
}

export function findVariant(p: Product, color: string, size: string): Variant | undefined {
  return p.variants.find((v) => v.color === color && v.size === size);
}

export function colorHasStock(p: Product, color: string) {
  return p.variants.some((v) => v.color === color && v.stock > 0);
}

/** Fotos de ese color primero; si no hay ninguna marcada, todas. */
export function imagesFor(p: Product, color?: string): ProductImage[] {
  if (!color) return p.images;
  const own = p.images.filter((i) => i.color === color);
  const shared = p.images.filter((i) => !i.color);
  return own.length ? [...own, ...shared] : p.images;
}

export function variantLabel(color: string, size: string) {
  return `${color ? `${color} · ` : ""}Talle ${size}`;
}

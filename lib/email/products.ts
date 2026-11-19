import type { Product } from "../types";
import type { CampaignKind, EmailProduct } from "./templates";

/** Talles con stock por color: "Negro: S, M. Bordó: M". */
export function sizesInStock(p: Product) {
  const colors = [...new Set(p.variants.map((v) => v.color))];
  return colors
    .map((c) => {
      const sizes = p.variants.filter((v) => v.color === c && v.stock > 0).map((v) => v.size);
      if (!sizes.length) return "";
      return `${c ? `${c}: ` : "Talles "}${sizes.join(", ")}`;
    })
    .filter(Boolean)
    .join(". ");
}

export function toEmailProducts(list: Product[], kind: CampaignKind, siteUrl: string): EmailProduct[] {
  return list.map((p) => ({
    name: p.name,
    price: p.price,
    compare_at_price: p.compare_at_price,
    image: p.images[0]?.url ?? null,
    url: `${siteUrl}/producto/${p.slug}`,
    note:
      kind === "stock"
        ? sizesInStock(p) || "Sin stock"
        : (p.colors ?? []).map((c) => c.name).join(" · "),
  }));
}

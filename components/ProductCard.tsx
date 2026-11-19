import Image from "next/image";
import Link from "next/link";
import { money } from "@/lib/format";
import { colorsOf, LOW_STOCK, stockSummary } from "@/lib/stock";
import type { Product } from "@/lib/types";

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const [a, b] = product.images;
  const { total, soldOut } = stockSummary(product);
  const off =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;
  const tag = soldOut ? "Sin stock" : off ? `−${off}%` : total > 0 && total <= LOW_STOCK ? "Últimas" : null;
  const colors = colorsOf(product);

  return (
    <Link href={`/producto/${product.slug}`} className="card">
      <div className="card__img">
        {a && (
          <Image src={a.url} alt={a.alt || product.name} fill sizes="(max-width: 760px) 50vw, 25vw" priority={priority} />
        )}
        {b && <Image src={b.url} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" className="card__alt" />}
        {tag && (
          <span className={`mini-tag${soldOut ? " mini-tag--sold" : ""}`}>
            <span>{tag}</span>
          </span>
        )}
      </div>
      <div className="card__body">
        <span className="card__name">{product.name}</span>
        <span className="price">
          {money(product.price)}
          {off > 0 && <s>{money(product.compare_at_price!)}</s>}
        </span>
        {colors.length > 1 && (
          <span className="card__swatches" aria-label={`${colors.length} colores: ${colors.map((c) => c.name).join(", ")}`}>
            {colors.slice(0, 5).map((c) => (
              <span key={c.name} className="dot" style={{ background: c.hex }} aria-hidden="true" />
            ))}
            {colors.length > 5 && <span aria-hidden="true">+{colors.length - 5}</span>}
          </span>
        )}
      </div>
    </Link>
  );
}

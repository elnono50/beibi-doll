import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/ProductCard";
import { SortSelect } from "@/components/SortSelect";
import { getCategories, getProducts, type ProductSort } from "@/lib/data";

type Props = { searchParams: Promise<{ categoria?: string; orden?: string }> };

const SORTS: ProductSort[] = ["destacados", "nuevos", "menor-precio", "mayor-precio"];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { categoria } = await searchParams;
  const cats = await getCategories();
  const cat = cats.find((c) => c.slug === categoria);
  return {
    title: cat ? cat.name : "Tienda",
    description: cat?.description || "Corsets, tops, jeans, minis y vestidos de Beibi Doll.",
    alternates: { canonical: cat ? `/tienda?categoria=${cat.slug}` : "/tienda" },
  };
}

export default async function Shop({ searchParams }: Props) {
  const sp = await searchParams;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === sp.categoria);
  const sort = SORTS.includes(sp.orden as ProductSort) ? (sp.orden as ProductSort) : "destacados";
  const products = await getProducts({ category: cat?.slug, sort });
  const qs = (slug?: string) => {
    const p = new URLSearchParams();
    if (slug) p.set("categoria", slug);
    if (sort !== "destacados") p.set("orden", sort);
    return `/tienda${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="wrap">
      <header className="shop-head">
        <h1>{cat ? cat.name : "Toda la tienda"}</h1>
        <p>{cat?.description || "Lo último que entró, en todos los talles mientras duren."}</p>
      </header>

      <div className="toolbar">
        <nav className="chips" aria-label="Líneas">
          <Link href={qs()} className="chip" aria-current={!cat ? "page" : undefined}>
            Todo
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={qs(c.slug)} className="chip" aria-current={cat?.slug === c.slug ? "page" : undefined}>
              {c.name}
            </Link>
          ))}
        </nav>
        <Suspense fallback={null}>
          <SortSelect value={sort} />
        </Suspense>
      </div>

      {products.length === 0 ? (
        <div className="empty">
          <h2>No hay productos en esta línea por ahora</h2>
          <p>Estamos preparando la próxima tanda. Mientras tanto, mirá el resto de la tienda.</p>
          <Link href="/tienda" className="btn btn--ghost">
            Ver toda la tienda
          </Link>
        </div>
      ) : (
        <>
          <p className="visually-hidden" aria-live="polite">
            {products.length} productos
          </p>
          <div className="grid">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

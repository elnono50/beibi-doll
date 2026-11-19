import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBuy } from "@/components/ProductBuy";
import { ProductCard } from "@/components/ProductCard";
import { getProduct, getProducts, getSettings } from "@/lib/data";
import { money } from "@/lib/format";
import { stockSummary } from "@/lib/stock";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Producto no encontrado" };
  return {
    title: p.name,
    description: p.description.slice(0, 160),
    alternates: { canonical: `/producto/${p.slug}` },
    openGraph: { title: p.name, description: p.description.slice(0, 160), images: p.images[0] ? [p.images[0].url] : [] },
  };
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProduct(slug), getSettings()]);
  if (!product) notFound();

  const related = (await getProducts({ category: product.category?.slug }))
    .filter((p) => p.id !== product.id)
    .slice(0, 4);
  const { soldOut } = stockSummary(product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { "@type": "Brand", name: "Beibi Doll" },
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: product.price,
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <div className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav className="crumbs" aria-label="Ubicación">
        <Link href="/tienda">Tienda</Link>
        {product.category && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/tienda?categoria=${product.category.slug}`}>{product.category.name}</Link>
          </>
        )}
      </nav>

      <ProductBuy product={product} sizeGuide={settings.size_guide}>
          <div className="accordion">
            {product.details && (
              <details open>
                <summary>Detalles</summary>
                <div className="accordion__body">
                  <ul>
                    {lines(product.details).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
            {product.care && (
              <details>
                <summary>Cuidados</summary>
                <div className="accordion__body">
                  <ul>
                    {lines(product.care).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
            <details>
              <summary>Envíos y cambios</summary>
              <div className="accordion__body">
                <p>
                  {settings.shipping.eta}{" "}
                  {settings.shipping.free_from ? `Envío gratis desde ${money(settings.shipping.free_from)}.` : ""}
                </p>
                <p style={{ marginTop: 8 }}>
                  Tenés 30 días para cambiar el talle o el color, con la prenda sin uso y con la etiqueta puesta.{" "}
                  <Link href="/ayuda/cambios">Ver la política completa</Link>.
                </p>
              </div>
            </details>
          </div>
      </ProductBuy>

      {related.length > 0 && (
        <section className="section" aria-labelledby="rel-title">
          <div className="section-head">
            <h2 id="rel-title">También te puede gustar</h2>
          </div>
          <div className="grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

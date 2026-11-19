import Image from "next/image";
import Link from "next/link";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getProducts, getSettings } from "@/lib/data";
import { money } from "@/lib/format";

export const revalidate = 60;

export default async function Home() {
  const [settings, categories, all] = await Promise.all([getSettings(), getCategories(), getProducts()]);
  // Destacados primero; completamos con el resto para que la grilla cierre en filas de 4
  const ordered = [...all.filter((p) => p.featured), ...all.filter((p) => !p.featured)];
  const products = ordered.slice(0, ordered.length >= 8 ? 8 : ordered.length >= 4 ? 4 : ordered.length);
  const { shipping, payments, editorial } = settings;
  const zones = shipping.zones.filter((z) => z.enabled);
  const fromPrice = zones.length ? Math.min(...zones.flatMap((z) => [z.price, ...z.tiers.map((t) => t.price)])) : null;

  return (
    <>
      <h1 className="visually-hidden">Beibi Doll, tienda de ropa en San Juan con envíos a todo el país</h1>
      <Hero slides={settings.hero} />

      {categories.length > 0 && (
        <section className="section wrap" aria-labelledby="cats-title">
          <div className="section-head">
            <h2 id="cats-title">Elegí qué buscás</h2>
            <Link href="/tienda" className="link">
              Ver todo
            </Link>
          </div>
          <div className="cats">
            {categories.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/tienda?categoria=${c.slug}`} className="cat">
                {c.image_url && <Image src={c.image_url} alt="" fill sizes="(max-width: 900px) 62vw, 25vw" />}
                <span className="cat__body">
                  <span className="cat__name">{c.name}</span>
                  {c.description && <span className="cat__desc">{c.description}</span>}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {products.length > 0 && (
        <section className="section wrap" style={{ paddingTop: 0 }} aria-labelledby="feat-title">
          <div className="section-head">
            <h2 id="feat-title">Lo que más sale</h2>
            <Link href="/tienda?orden=nuevos" className="link">
              Ver lo nuevo
            </Link>
          </div>
          <div className="grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="editorial" aria-labelledby="ed-title">
        <div className="editorial__img">
          {editorial.image && (
            <Image src={editorial.image} alt={editorial.image_alt} fill sizes="(max-width: 860px) 100vw, 50vw" />
          )}
        </div>
        <div className="editorial__body">
          <h2 id="ed-title" className="editorial__quote">
            {editorial.title}
          </h2>
          {editorial.text && <p>{editorial.text}</p>}
          <Link href="/tienda" className="btn" style={{ justifySelf: "start" }}>
            Ver toda la tienda
          </Link>
        </div>
      </section>

      <section className="section wrap" aria-labelledby="info-title">
        <h2 id="info-title" className="visually-hidden">
          Cómo comprar
        </h2>
        <div className="info">
          <div className="info__item">
            <h3>Envíos a todo el país</h3>
            <p>
              {fromPrice != null ? `Desde ${money(fromPrice)}, a domicilio o a sucursal. ` : ""}
              {shipping.free_from ? `Gratis en compras desde ${money(shipping.free_from)}. ` : ""}
              {shipping.pickup.enabled ? "O retirás sin cargo en nuestro local de San Juan." : ""}
            </p>
          </div>
          <div className="info__item">
            <h3>Pagá como prefieras</h3>
            <p>
              {[
                payments.mercadopago.enabled && "Tarjeta, débito o dinero en cuenta con Mercado Pago",
                payments.transfer.enabled &&
                  `transferencia${payments.transfer.discount_pct ? ` con ${payments.transfer.discount_pct}% de descuento` : ""}`,
                payments.cash.enabled && "efectivo al retirar",
              ]
                .filter(Boolean)
                .join(", ")
                .replace(/^./, (c) => c.toUpperCase())}
              .
            </p>
          </div>
          <div className="info__item">
            <h3>Cambios</h3>
            <p>Tenés 30 días para cambiar tu prenda sin uso y con la etiqueta puesta.</p>
            <Link href="/ayuda/cambios" className="link" style={{ justifySelf: "start", marginTop: 4 }}>
              Ver la política de cambios
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { money } from "@/lib/format";
import { colorHasStock, colorsOf, findVariant, imagesFor, LOW_STOCK, sizesOf } from "@/lib/stock";
import type { Product, Settings } from "@/lib/types";
import { useCart } from "./CartProvider";
import { CloseIcon } from "./Icons";
import { StockAlert } from "./StockAlert";

/**
 * Ficha de producto: galería + elección de color y talle.
 * La galería cambia con el color elegido (si la administradora marcó fotos por color).
 */
export function ProductBuy({
  product,
  sizeGuide,
  children,
}: {
  product: Product;
  sizeGuide: Settings["size_guide"];
  children?: React.ReactNode;
}) {
  const { add, setOpen, toast } = useCart();
  const colors = colorsOf(product);
  const hasColors = colors.length > 0;

  const firstColor = colors.find((c) => colorHasStock(product, c.name))?.name ?? colors[0]?.name ?? "";
  const [color, setColor] = useState(firstColor);
  const [size, setSize] = useState<string>();
  const [qty, setQty] = useState(1);
  const [tried, setTried] = useState(false);
  const guide = useRef<HTMLDialogElement>(null);

  const sizes = sizesOf(product, hasColors ? color : undefined);
  const current = size ? findVariant(product, hasColors ? color : "", size) : undefined;
  const max = current ? current.stock : 10;
  const colorSoldOut = !product.variants.some((v) => (hasColors ? v.color === color : true) && v.stock > 0);
  const images = useMemo(() => imagesFor(product, hasColors ? color : undefined), [product, color, hasColors]);
  const soldOutHere = product.variants.filter((v) => (hasColors ? v.color === color : true) && v.stock <= 0);

  const off =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;

  function pickColor(name: string) {
    setColor(name);
    setTried(false);
    // Si el talle elegido no existe o no tiene stock en el nuevo color, se limpia
    const v = size ? findVariant(product, name, size) : undefined;
    if (!v || v.stock <= 0) setSize(undefined);
    setQty(1);
  }

  function onAdd() {
    setTried(true);
    if (!current) return;
    if (current.stock <= 0) {
      toast("Ese talle se agotó recién. Probá con otro.", "error");
      return;
    }
    add(
      {
        variant_id: current.id,
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        image: images[0]?.url ?? null,
        color: current.color,
        size: current.size,
        unit_price: product.price,
        quantity: Math.min(qty, current.stock),
      },
      current.stock,
    );
    setOpen(true);
  }

  return (
    <div className="pdp">
      <div className="gallery" aria-label="Fotos del producto">
        {images.length === 0 && <div className="gallery__item" />}
        {images.map((img, i) => (
          <div className="gallery__item" key={img.id}>
            <Image
              src={img.url}
              alt={img.alt || `${product.name}, foto ${i + 1}`}
              fill
              priority={i === 0}
              sizes="(max-width: 860px) 88vw, 40vw"
            />
          </div>
        ))}
      </div>

      <div className="buy">
        <div className="buy__head">
          {product.category && <p className="buy__kicker">{product.category.name}</p>}
          <h1>{product.name}</h1>
        </div>

        <div className="buy__price price">
          {money(product.price)}
          {off > 0 && (
            <>
              <s>{money(product.compare_at_price!)}</s>
              <span className="price__off">−{off}%</span>
            </>
          )}
        </div>

        {product.description && <p className="buy__desc">{product.description}</p>}

        {hasColors && (
          <fieldset className="option-group">
            <legend>
              <span>
                Color: <b>{color}</b>
              </span>
            </legend>
            <div className="swatches">
              {colors.map((c) => {
                const out = !colorHasStock(product, c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    className={`swatch${out ? " swatch--out" : ""}`}
                    aria-pressed={color === c.name}
                    aria-label={out ? `${c.name}, sin stock` : c.name}
                    title={c.name}
                    onClick={() => pickColor(c.name)}
                  >
                    <span style={{ background: c.hex }} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="option-group">
          <legend>
            <span>
              Talle
              {size ? (
                <>
                  : <b>{size}</b>
                </>
              ) : null}
            </span>
            <button type="button" className="link" onClick={() => guide.current?.showModal()}>
              Guía de talles
            </button>
          </legend>
          <div className="sizes">
            {sizes.map((sz) => {
              const v = findVariant(product, hasColors ? color : "", sz);
              const out = !v || v.stock <= 0;
              return (
                <button
                  key={sz}
                  type="button"
                  className="size"
                  aria-pressed={size === sz}
                  disabled={out}
                  onClick={() => {
                    setSize(sz);
                    setQty(1);
                  }}
                  aria-label={out ? `${sz}, sin stock` : `Talle ${sz}`}
                >
                  {sz}
                </button>
              );
            })}
          </div>
          <p className="stock-note" aria-live="polite" style={tried && !current ? { color: "var(--error)" } : undefined}>
            {tried && !current
              ? "Elegí un talle"
              : current && current.stock <= LOW_STOCK
                ? current.stock === 1
                  ? "Queda 1 en este talle"
                  : `Quedan ${current.stock} en este talle`
                : ""}
          </p>
        </fieldset>

        <StockAlert key={color} soldOut={soldOutHere} openByDefault={colorSoldOut} />

        <div className="buy__row">
          <div className="qty" role="group" aria-label="Cantidad">
            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Restar uno">
              −
            </button>
            <output aria-live="polite">{qty}</output>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(max, 10, q + 1))}
              disabled={qty >= Math.min(max, 10)}
              aria-label="Sumar uno"
            >
              +
            </button>
          </div>
          <button type="button" className="btn" onClick={onAdd} disabled={colorSoldOut}>
            {colorSoldOut ? "Sin stock" : "Agregar a la bolsa"}
          </button>
        </div>

        {children}
      </div>

      <dialog
        className="dialog"
        ref={guide}
        aria-labelledby="guide-title"
        onClick={(e) => e.target === guide.current && guide.current?.close()}
      >
        <div className="dialog__inner">
          <div className="dialog__head">
            <h2 id="guide-title">Guía de talles</h2>
            <button className="icon-btn" onClick={() => guide.current?.close()} aria-label="Cerrar guía">
              <CloseIcon />
            </button>
          </div>
          <p className="muted" style={{ fontSize: "var(--t-sm)" }}>
            Medidas del cuerpo en centímetros. Si quedás entre dos talles, elegí el más grande.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Talle</th>
                  <th scope="col">Busto</th>
                  <th scope="col">Cintura</th>
                  <th scope="col">Cadera</th>
                </tr>
              </thead>
              <tbody>
                {sizeGuide.map((r) => (
                  <tr key={r.size}>
                    <th scope="row">{r.size}</th>
                    <td>{r.busto}</td>
                    <td>{r.cintura}</td>
                    <td>{r.cadera}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </dialog>
    </div>
  );
}

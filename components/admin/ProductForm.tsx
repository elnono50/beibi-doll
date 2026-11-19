"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProduct, saveProduct, type ProductInput } from "@/app/admin/actions";
import { slugify } from "@/lib/format";
import { sizesOf } from "@/lib/stock";
import type { Category, Product } from "@/lib/types";
import { ImageUpload } from "./ImageUpload";
import { SaveMessage, useSave } from "./useSave";

type C = { key: string; name: string; hex: string };
type S = { key: string; label: string };
type Cell = { id?: string; stock: number; was?: number };
type I = { id?: string; key: string; url: string; path?: string | null; alt: string; color: string };

const NO_COLOR = "_";
const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: "Negro", hex: "#111111" },
  { name: "Blanco", hex: "#F2F0EC" },
  { name: "Bordó", hex: "#5E1224" },
  { name: "Rojo", hex: "#B3122E" },
  { name: "Chocolate", hex: "#4A2C20" },
  { name: "Gris", hex: "#8A8D91" },
  { name: "Azul gastado", hex: "#6F8CAD" },
  { name: "Leopardo", hex: "#B98A57" },
  { name: "Rosa", hex: "#E8A3B5" },
];
const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "S a XL", sizes: ["S", "M", "L", "XL"] },
  { label: "36 a 44", sizes: ["36", "38", "40", "42", "44"] },
  { label: "Talle único", sizes: ["U"] },
];
let seq = 0;
const k = () => `n${++seq}`;
const cellKey = (c: string, s: string) => `${c}|${s}`;

function toInt(v: string): number | null {
  const n = Number(String(v).replace(/[^\d]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

export function Stepper({
  value,
  onChange,
  label,
  low = 2,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  low?: number;
}) {
  return (
    <div className={`step${value <= low ? " step--low" : ""}`}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Restar uno a ${label}`}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Math.max(0, Math.min(100000, Math.floor(Number(e.target.value) || 0))))}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label={`Sumar uno a ${label}`}>
        +
      </button>
    </div>
  );
}

export function ProductForm({
  product,
  categories,
  demo,
}: {
  product: Product | null;
  categories: Category[];
  demo: boolean;
}) {
  const router = useRouter();
  const { pending, msg, run } = useSave();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [compare, setCompare] = useState(product?.compare_at_price ? String(product.compare_at_price) : "");
  const [weight, setWeight] = useState(product ? String(product.weight_g) : "300");
  const [description, setDescription] = useState(product?.description ?? "");
  const [details, setDetails] = useState(product?.details ?? "");
  const [care, setCare] = useState(product?.care ?? "");
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [active, setActive] = useState(product?.active ?? true);
  const [sort, setSort] = useState(product?.sort ?? 0);

  // Colores y talles. Las claves internas no cambian aunque se renombre un color o un talle.
  const initColors: C[] = (product?.colors ?? []).map((c) => ({ key: k(), name: c.name, hex: c.hex }));
  const initSizes: S[] = (product ? sizesOf(product) : ["S", "M", "L", "XL"]).map((label) => ({ key: k(), label }));
  const [colors, setColors] = useState<C[]>(initColors);
  const [sizes, setSizes] = useState<S[]>(initSizes);
  const [cells, setCells] = useState<Record<string, Cell>>(() => {
    const out: Record<string, Cell> = {};
    for (const v of product?.variants ?? []) {
      const c = initColors.find((x) => x.name === v.color)?.key ?? NO_COLOR;
      const sz = initSizes.find((x) => x.label === v.size)?.key;
      if (sz) out[cellKey(c, sz)] = { id: v.id, stock: v.stock, was: v.stock };
    }
    return out;
  });
  const [newSize, setNewSize] = useState("");
  const [images, setImages] = useState<I[]>(
    product?.images.map((i) => ({ id: i.id, key: i.id, url: i.url, path: i.path, alt: i.alt, color: i.color ?? "" })) ?? [],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rowsOfColors: { key: string; name: string; hex?: string }[] = colors.length
    ? colors
    : [{ key: NO_COLOR, name: "" }];
  const stockOf = (c: string, sz: string) => cells[cellKey(c, sz)]?.stock ?? 0;
  const setStock = (c: string, sz: string, n: number) =>
    setCells((m) => ({ ...m, [cellKey(c, sz)]: { ...(m[cellKey(c, sz)] ?? {}), stock: n } }));
  const totalStock = rowsOfColors.reduce((a, c) => a + sizes.reduce((b, sz) => b + stockOf(c.key, sz.key), 0), 0);

  function addColor(name = "", hex = "#111111") {
    if (colors.length >= 20) return;
    if (name && colors.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    const key = k();
    // El primer color hereda el stock que estaba cargado "sin color"
    if (!colors.length) {
      setCells((m) => {
        const out: Record<string, Cell> = {};
        for (const [ck, v] of Object.entries(m)) {
          const [c, sz] = ck.split("|");
          out[c === NO_COLOR ? cellKey(key, sz) : ck] = v;
        }
        return out;
      });
    }
    setColors((l) => [...l, { key, name, hex }]);
  }

  function removeColor(key: string) {
    setColors((l) => l.filter((c) => c.key !== key));
    setCells((m) => Object.fromEntries(Object.entries(m).filter(([ck]) => !ck.startsWith(`${key}|`))));
  }

  function addSizes(labels: string[]) {
    const have = new Set(sizes.map((s) => s.label.toUpperCase()));
    const add = labels.map((l) => l.trim().toUpperCase()).filter((l) => l && !have.has(l));
    if (add.length) setSizes((l) => [...l, ...add.map((label) => ({ key: k(), label }))]);
  }

  function removeSize(key: string) {
    setSizes((l) => l.filter((s) => s.key !== key));
    setCells((m) => Object.fromEntries(Object.entries(m).filter(([ck]) => !ck.endsWith(`|${key}`))));
  }

  function move(i: number, d: -1 | 1) {
    setImages((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceN = toInt(price);
    if (priceN == null) {
      run(async () => ({ ok: false, error: "Poné el precio del producto." }));
      return;
    }
    if (colors.some((c) => !c.name.trim())) {
      run(async () => ({ ok: false, error: "Poné el nombre de cada color." }));
      return;
    }
    if (sizes.some((s) => !s.label.trim())) {
      run(async () => ({ ok: false, error: "Hay un talle sin nombre." }));
      return;
    }
    const colorName = (key: string) => colors.find((c) => c.key === key)?.name.trim() ?? "";
    let order = 0;
    const variants = rowsOfColors.flatMap((c) =>
      sizes.map((sz) => {
        const cell = cells[cellKey(c.key, sz.key)];
        return {
          id: cell?.id,
          color: c.key === NO_COLOR ? "" : colorName(c.key),
          size: sz.label.trim(),
          stock: cell?.stock ?? 0,
          stock_was: cell?.id ? cell.was : undefined,
          sort: order++,
        };
      }),
    );
    const payload: ProductInput = {
      id: product?.id && /^[0-9a-f-]{36}$/.test(product.id) ? product.id : undefined,
      name,
      slug: slug || slugify(name),
      category_id: categoryId || null,
      price: priceN,
      compare_at_price: toInt(compare),
      colors: colors.map((c) => ({ name: c.name.trim(), hex: c.hex })),
      weight_g: toInt(weight) ?? 300,
      description,
      details,
      care,
      featured,
      active,
      sort,
      variants,
      images: images.map((im, i) => {
        const c = colors.find((x) => x.key === im.color);
        return { id: im.id, url: im.url, path: im.path ?? null, alt: im.alt, color: c ? c.name.trim() : null, sort: i };
      }),
    };
    run(
      () => saveProduct(payload),
      product ? "Producto guardado" : "Producto creado",
      (r) => {
        if (!product && r.ok && r.id) router.replace(`/admin/productos/${r.id}`);
        else router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="form-stack" style={{ gap: 24 }}>
      <div className="two-col">
        <div className="form-stack" style={{ gap: 24 }}>
          <section className="panel">
            <h2>Información</h2>
            <label className="field">
              <span>Nombre</span>
              <input
                className="input"
                value={name}
                maxLength={120}
                required
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <div className="row-2">
              <label className="field">
                <span>Categoría</span>
                <select className="select input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Peso con embalaje (gramos)</span>
                <input className="input" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d]/g, "").slice(0, 5))} />
                <small>Se usa para calcular el envío. Una remera pesa unos 200 g, un jean unos 700 g.</small>
              </label>
            </div>
            <label className="field">
              <span>Descripción</span>
              <textarea className="textarea" value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="row-2">
              <label className="field">
                <span>Detalles</span>
                <textarea className="textarea" value={details} maxLength={4000} onChange={(e) => setDetails(e.target.value)} />
                <small>Uno por renglón. Se muestran como lista.</small>
              </label>
              <label className="field">
                <span>Cuidados</span>
                <textarea className="textarea" value={care} maxLength={2000} onChange={(e) => setCare(e.target.value)} />
                <small>Uno por renglón.</small>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Fotos</h2>
            <p className="panel__hint">
              La primera es la portada. La segunda aparece al pasar el mouse en la tienda. Si marcás una foto con un color,
              se muestra cuando la clienta elige ese color.
            </p>
            <div className="images">
              {images.map((im, i) => (
                <div className="img-tile" key={im.key}>
                  <div className="img-tile__pic">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={im.url} alt="" />
                    {i === 0 && <span className="img-tile__badge">Portada</span>}
                  </div>
                  <input
                    className="input"
                    placeholder="Descripción de la foto"
                    aria-label="Descripción de la foto, para accesibilidad"
                    value={im.alt}
                    maxLength={200}
                    onChange={(e) => setImages((l) => l.map((x) => (x.key === im.key ? { ...x, alt: e.target.value } : x)))}
                  />
                  {colors.length > 0 && (
                    <select
                      className="select input"
                      aria-label="Color de la foto"
                      value={im.color}
                      onChange={(e) => setImages((l) => l.map((x) => (x.key === im.key ? { ...x, color: e.target.value } : x)))}
                    >
                      <option value="">Todos los colores</option>
                      {colors.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name || "Color sin nombre"}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="img-tile__actions">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover antes">
                      ←
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1} aria-label="Mover después">
                      →
                    </button>
                    <button type="button" onClick={() => setImages((l) => l.filter((x) => x.key !== im.key))} aria-label="Quitar foto">
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              {images.length < 12 && (
                <ImageUpload
                  folder="productos"
                  multiple
                  demo={demo}
                  onUploaded={(files) =>
                    setImages((l) => [...l, ...files.map((f) => ({ key: k(), url: f.url, path: f.path, alt: name, color: "" }))].slice(0, 12))
                  }
                />
              )}
            </div>
          </section>
        </div>

        <div className="form-stack" style={{ gap: 24 }}>
          <section className="panel">
            <h2>Publicación</h2>
            <label className="toggle">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span>
                Visible en la tienda
                <small>Si lo apagás, nadie lo ve ni lo puede comprar.</small>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              <span>
                Destacado
                <small>Aparece primero en el inicio y en la tienda.</small>
              </span>
            </label>
            <label className="field">
              <span>Dirección web</span>
              <input
                className="input"
                value={slug}
                maxLength={90}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
              <small>…/producto/{slug || "nombre"}</small>
            </label>
            <label className="field">
              <span>Orden</span>
              <input className="input" type="number" min={0} value={sort} onChange={(e) => setSort(Math.max(0, Number(e.target.value) || 0))} />
              <small>Los números más bajos aparecen primero.</small>
            </label>
          </section>

          <section className="panel">
            <h2>Precio</h2>
            <div className="row-2">
              <label className="field">
                <span>Precio</span>
                <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="32900" required />
              </label>
              <label className="field">
                <span>Precio anterior (opcional)</span>
                <input className="input" inputMode="numeric" value={compare} onChange={(e) => setCompare(e.target.value.replace(/[^\d]/g, ""))} />
                <small>Se muestra tachado, como oferta.</small>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Colores</h2>
            <p className="panel__hint">Cada color tiene su propio stock por talle. Si la prenda viene en un solo color, podés no cargar ninguno.</p>
            {colors.map((c) => (
              <div className="color-row" key={c.key}>
                <label className="color-pick" style={{ background: c.hex }}>
                  <input
                    type="color"
                    value={c.hex}
                    aria-label={`Tono del color ${c.name || "nuevo"}`}
                    onChange={(e) => setColors((l) => l.map((x) => (x.key === c.key ? { ...x, hex: e.target.value } : x)))}
                  />
                </label>
                <input
                  className="input"
                  value={c.name}
                  maxLength={40}
                  placeholder="Nombre del color"
                  aria-label="Nombre del color"
                  onChange={(e) => setColors((l) => l.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)))}
                />
                <button type="button" className="link" onClick={() => removeColor(c.key)} aria-label={`Quitar color ${c.name}`}>
                  Quitar
                </button>
              </div>
            ))}
            <div className="chips" aria-label="Agregar un color rápido">
              {PRESET_COLORS.filter((p) => !colors.some((c) => c.name.toLowerCase() === p.name.toLowerCase())).map((p) => (
                <button key={p.name} type="button" className="chip" onClick={() => addColor(p.name, p.hex)}>
                  <span className="dot" style={{ background: p.hex }} aria-hidden="true" />+ {p.name}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => addColor()}>
                + Otro color
              </button>
            </div>
          </section>

          <section className="panel">
            <h2>Talles y stock</h2>
            <p className="panel__hint">
              El stock baja solo con cada venta. Acá lo reponés cuando entra mercadería. Total: <b>{totalStock}</b>
            </p>
            <div className="chips">
              {sizes.map((sz) => (
                <span className="chip chip--static" key={sz.key}>
                  <input
                    className="chip__input"
                    value={sz.label}
                    maxLength={12}
                    aria-label="Nombre del talle"
                    size={Math.max(2, sz.label.length)}
                    onChange={(e) => setSizes((l) => l.map((x) => (x.key === sz.key ? { ...x, label: e.target.value.toUpperCase() } : x)))}
                  />
                  <button type="button" onClick={() => removeSize(sz.key)} aria-label={`Quitar talle ${sz.label}`}>
                    ×
                  </button>
                </span>
              ))}
              <span className="chip chip--add">
                <input
                  className="chip__input"
                  value={newSize}
                  maxLength={12}
                  placeholder="Nuevo"
                  aria-label="Agregar talle"
                  size={6}
                  onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSizes([newSize]);
                      setNewSize("");
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    addSizes([newSize]);
                    setNewSize("");
                  }}
                  aria-label="Agregar talle"
                >
                  +
                </button>
              </span>
            </div>
            {sizes.length === 0 && (
              <div className="chips">
                {SIZE_PRESETS.map((p) => (
                  <button key={p.label} type="button" className="chip" onClick={() => addSizes(p.sizes)}>
                    Cargar {p.label}
                  </button>
                ))}
              </div>
            )}

            {sizes.length > 0 &&
              rowsOfColors.map((c) => (
                <div className="stock-block" key={c.key}>
                  {c.key !== NO_COLOR && (
                    <b className="stock-block__title">
                      <span className="dot" style={{ background: c.hex }} aria-hidden="true" />
                      {c.name || "Color sin nombre"}
                    </b>
                  )}
                  <div className="stock-cells">
                    {sizes.map((sz) => (
                      <label className="stock-cell" key={sz.key}>
                        <span>{sz.label || "?"}</span>
                        <Stepper
                          label={`stock de ${c.name ? `${c.name} ` : ""}talle ${sz.label}`}
                          value={stockOf(c.key, sz.key)}
                          onChange={(n) => setStock(c.key, sz.key, n)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </section>

          {product && (
            <section className="panel">
              <h2>Eliminar</h2>
              <p className="panel__hint">Si sólo querés ocultarlo, apagá “Visible en la tienda”. Los pedidos viejos no se borran.</p>
              {confirmDelete ? (
                <div className="actions-row">
                  <button
                    type="button"
                    className="btn danger"
                    disabled={pending}
                    onClick={() => run(() => deleteProduct(product.id), "Producto eliminado")}
                  >
                    Sí, eliminar para siempre
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>
                    No, volver
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn--ghost danger" onClick={() => setConfirmDelete(true)}>
                  Eliminar producto
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="savebar">
        <SaveMessage msg={msg} />
        <button type="button" className="btn btn--ghost" onClick={() => router.push("/admin/productos")}>
          Volver
        </button>
        <button className="btn" disabled={pending}>
          {pending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

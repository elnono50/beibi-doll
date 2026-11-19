"use client";

import { useMemo, useState } from "react";
import { sendNewsletter, type CampaignInput } from "@/app/admin/actions";
import { sizesInStock, toEmailProducts } from "@/lib/email/products";
import { newsletter, type CampaignKind } from "@/lib/email/templates";
import type { Product, Settings } from "@/lib/types";
import { ImageUpload } from "./ImageUpload";
import { SaveMessage, useSave } from "./useSave";

type Fields = Pick<CampaignInput, "subject" | "preheader" | "title" | "text" | "cta_label" | "cta_url">;

const KINDS: { kind: CampaignKind; label: string; hint: string }[] = [
  { kind: "nuevos", label: "Llegó lo nuevo", hint: "Productos recién cargados" },
  { kind: "stock", label: "Volvió el stock", hint: "Muestra los talles disponibles" },
  { kind: "libre", label: "Mail libre", hint: "Promos, avisos, temporada" },
];

const preset = (kind: CampaignKind, site: string): Fields => {
  if (kind === "nuevos")
    return {
      subject: "Llegó lo nuevo a Beibi Doll",
      preheader: "Te lo mostramos antes que en Instagram.",
      title: "Recién llegados",
      text: "Te mostramos primero lo último que entró a la tienda.\n\nSon cantidades chicas: si algo te gusta, no lo dejes para después.",
      cta_label: "Ver lo nuevo",
      cta_url: `${site}/tienda?orden=nuevos`,
    };
  if (kind === "stock")
    return {
      subject: "Volvieron talles que estaban agotados",
      preheader: "Repusimos los que más nos pidieron.",
      title: "Repusimos talles",
      text: "Entraron de nuevo los talles que más nos pidieron. Te dejamos lo que volvió y qué talles hay de cada uno.",
      cta_label: "Ver la tienda",
      cta_url: `${site}/tienda`,
    };
  return { subject: "", preheader: "", title: "", text: "", cta_label: "Ver la colección", cta_url: `${site}/tienda` };
};

export function NewsletterComposer({
  settings,
  products,
  activeCount,
  siteUrl,
  demo,
  enabled,
}: {
  settings: Settings;
  products: Product[];
  activeCount: number;
  siteUrl: string;
  demo: boolean;
  enabled: boolean;
}) {
  const [kind, setKind] = useState<CampaignKind>("nuevos");
  const [f, setF] = useState<Fields>(preset("nuevos", siteUrl));
  const [image, setImage] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const { pending, msg, run } = useSave();
  const set = (k: keyof Fields, v: string) => setF((x) => ({ ...x, [k]: v }));

  function changeKind(next: CampaignKind) {
    if (next === kind) return;
    const before = preset(kind, siteUrl);
    const after = preset(next, siteUrl);
    // Sólo reemplaza lo que ella no tocó
    setF((cur) => {
      const out = { ...cur };
      (Object.keys(after) as (keyof Fields)[]).forEach((k) => {
        if (!cur[k] || cur[k] === before[k]) out[k] = after[k];
      });
      return out;
    });
    setKind(next);
    setConfirm(false);
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 8 ? p : [...p, id]));

  const pickedProducts = picked.map((id) => products.find((p) => p.id === id)).filter(Boolean) as Product[];
  // Para "volvió el stock" primero los que tienen talles disponibles
  const list = useMemo(
    () => (kind === "stock" ? [...products].sort((a, b) => Number(!sizesInStock(a)) - Number(!sizesInStock(b))) : products),
    [products, kind],
  );

  const input: CampaignInput = {
    kind,
    product_ids: picked,
    subject: f.subject,
    preheader: f.preheader,
    title: f.title,
    text: f.text,
    image,
    image_alt: "",
    cta_label: f.cta_label,
    cta_url: f.cta_url,
  };

  const preview = useMemo(
    () =>
      newsletter(
        {
          kind,
          subject: f.subject || "Asunto",
          preheader: f.preheader ?? "",
          title: f.title || "Título del mail",
          text: f.text || "Acá va el texto. Dejá una línea en blanco entre párrafos.",
          image,
          image_alt: "",
          cta_label: f.cta_label ?? "",
          cta_url: f.cta_url ?? "",
          products: toEmailProducts(pickedProducts, kind, siteUrl),
        },
        settings,
        `${siteUrl}/baja`,
      ).html.replace(/<link [^>]*fonts\.googleapis[^>]*>/, ""), // la política de seguridad del panel no carga fuentes externas
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, f, image, picked, settings, siteUrl],
  );

  return (
    <section className="panel">
      <h2>Escribir un mail de novedades</h2>
      <p className="panel__hint">
        Elegí el tipo de mail y los productos: las tarjetas con foto, precio y talles se arman solas. Mandate una prueba
        antes de enviarlo.
      </p>

      <div className="kind-picker" role="radiogroup" aria-label="Tipo de mail">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} onClick={() => changeKind(k.kind)}>
            <b>{k.label}</b>
            <small>{k.hint}</small>
          </button>
        ))}
      </div>

      <div className="composer">
        <div className="form-stack">
          <label className="field">
            <span>Asunto</span>
            <input className="input" value={f.subject} maxLength={150} onChange={(e) => set("subject", e.target.value)} />
          </label>
          <label className="field">
            <span>Texto de vista previa (opcional)</span>
            <input className="input" value={f.preheader} maxLength={150} onChange={(e) => set("preheader", e.target.value)} placeholder="Lo que se lee al lado del asunto en la bandeja" />
          </label>
          <label className="field">
            <span>Título</span>
            <input className="input" value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="field">
            <span>Texto</span>
            <textarea className="textarea" rows={5} value={f.text} maxLength={5000} onChange={(e) => set("text", e.target.value)} />
            <small>Dejá una línea en blanco entre párrafos.</small>
          </label>

          <div className="field">
            <span>
              Productos del mail {kind === "libre" ? "(opcional)" : ""} <small>({picked.length} de 8)</small>
            </span>
            {products.length === 0 ? (
              <p className="muted" style={{ fontSize: "var(--t-sm)" }}>
                Todavía no hay productos visibles en la tienda.
              </p>
            ) : (
              <div className="product-picker">
                {list.map((p) => {
                  const on = picked.includes(p.id);
                  const sizes = sizesInStock(p);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="product-pick"
                      aria-pressed={on}
                      onClick={() => toggle(p.id)}
                      disabled={!on && picked.length >= 8}
                    >
                      <span className="thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.images[0] && <img src={p.images[0].url} alt="" loading="lazy" />}
                      </span>
                      <span className="product-pick__text">
                        <b>{p.name}</b>
                        <small>{kind === "stock" ? sizes || "Sin stock" : p.colors.map((c) => c.name).join(" · ")}</small>
                      </span>
                      <span className="product-pick__check" aria-hidden="true">
                        {on ? picked.indexOf(p.id) + 1 : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <small>Aparecen en el mail en el orden en que los elegís.</small>
          </div>

          <div className="field">
            <span>Foto principal (opcional)</span>
            {image ? (
              <div className="actions-row" style={{ alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" style={{ width: 96, height: 120, objectFit: "cover" }} />
                <button type="button" className="link" onClick={() => setImage("")}>
                  Quitar foto
                </button>
              </div>
            ) : (
              <ImageUpload folder="inicio" demo={demo} wide label="Subir foto" onUploaded={([u]) => setImage(u.url)} />
            )}
          </div>
          <div className="row-2">
            <label className="field">
              <span>Texto del botón</span>
              <input className="input" value={f.cta_label} maxLength={40} onChange={(e) => set("cta_label", e.target.value)} />
            </label>
            <label className="field">
              <span>El botón lleva a</span>
              <input className="input" type="url" value={f.cta_url} maxLength={400} onChange={(e) => set("cta_url", e.target.value.trim())} />
            </label>
          </div>

          <div className="actions-row" style={{ alignItems: "center" }}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={pending}
              onClick={() => run(() => sendNewsletter(input, "test"), "Te mandamos la prueba a tu email")}
            >
              Enviarme una prueba
            </button>
            {confirm ? (
              <>
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => sendNewsletter(input, "all"),
                      `Mail enviado a ${activeCount} ${activeCount === 1 ? "persona" : "personas"}`,
                      () => setConfirm(false),
                    )
                  }
                >
                  {pending ? "Enviando…" : `Sí, enviar a ${activeCount}`}
                </button>
                <button type="button" className="link" onClick={() => setConfirm(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="btn" disabled={pending || activeCount === 0} onClick={() => setConfirm(true)}>
                Enviar a {activeCount} {activeCount === 1 ? "suscripta" : "suscriptas"}
              </button>
            )}
          </div>
          <SaveMessage msg={msg} />
        </div>

        <div className="composer__preview">
          <span className="muted" style={{ fontSize: "var(--t-xs)" }}>
            Vista previa
          </span>
          <iframe title="Vista previa del mail" sandbox="" srcDoc={preview} />
        </div>
      </div>
    </section>
  );
}

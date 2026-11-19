"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCategories, saveSettings } from "@/app/admin/actions";
import type { Category, HeroSlide, Settings } from "@/lib/types";
import { ImageUpload } from "./ImageUpload";
import { SaveMessage, useSave } from "./useSave";

const LINKS = [
  { href: "/tienda", label: "Toda la tienda" },
  { href: "/ayuda/envios", label: "Envíos y pagos" },
];

export function HomeEditor({ settings, categories, demo }: { settings: Settings; categories: Category[]; demo: boolean }) {
  const router = useRouter();
  const { pending, msg, run } = useSave();
  const [hero, setHero] = useState<HeroSlide[]>(settings.hero);
  const [announcements, setAnnouncements] = useState<string[]>(settings.announcements);
  const [editorial, setEditorial] = useState(settings.editorial);
  const [cats, setCats] = useState(categories);

  const links = [...LINKS, ...categories.map((c) => ({ href: `/tienda?categoria=${c.slug}`, label: c.name }))];
  const upd = (id: string, patch: Partial<HeroSlide>) => setHero((h) => h.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const moveSlide = (i: number, d: -1 | 1) =>
    setHero((h) => {
      const n = [...h];
      const j = i + d;
      if (j < 0 || j >= n.length) return h;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  function save() {
    run(
      async () => {
        const a = await saveSettings({ hero, announcements: announcements.map((x) => x.trim()).filter(Boolean), editorial });
        if (!a.ok) return a;
        return saveCategories(
          cats.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description,
            image_url: c.image_url ?? "",
            sort: c.sort,
            active: c.active,
          })),
        );
      },
      "Página de inicio actualizada",
      () => router.refresh(),
    );
  }

  return (
    <div className="form-stack" style={{ gap: 24 }}>
      <section className="panel">
        <h2>Imágenes principales</h2>
        <p className="panel__hint">Hasta 5. Van rotando cada 7 segundos. Usá fotos verticales u horizontales de buena calidad.</p>
        {hero.map((s, i) => (
          <div className="slide-card" key={s.id}>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <div className="slide-card__pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.image && <img src={s.image} alt="" />}
              </div>
              <ImageUpload folder="inicio" demo={demo} label="Cambiar foto" onUploaded={([f]) => upd(s.id, { image: f.url })} />
            </div>
            <div className="form-stack">
              <label className="field">
                <span>Título</span>
                <input className="input" value={s.title} maxLength={80} onChange={(e) => upd(s.id, { title: e.target.value })} />
              </label>
              <label className="field">
                <span>Texto</span>
                <textarea className="textarea" value={s.text} maxLength={240} rows={3} onChange={(e) => upd(s.id, { text: e.target.value })} />
              </label>
              <div className="row-2">
                <label className="field">
                  <span>Texto del botón</span>
                  <input className="input" value={s.cta_label} maxLength={40} onChange={(e) => upd(s.id, { cta_label: e.target.value })} />
                </label>
                <label className="field">
                  <span>El botón lleva a</span>
                  <select className="select input" value={s.cta_href} onChange={(e) => upd(s.id, { cta_href: e.target.value })}>
                    {!links.some((l) => l.href === s.cta_href) && <option value={s.cta_href}>{s.cta_href}</option>}
                    {links.map((l) => (
                      <option key={l.href} value={l.href}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Descripción de la foto</span>
                <input className="input" value={s.image_alt} maxLength={200} onChange={(e) => upd(s.id, { image_alt: e.target.value })} />
                <small>La leen los lectores de pantalla y Google. Ej.: “Chica con corset negro y jean”.</small>
              </label>
              <div className="slide-card__tools">
                <button type="button" className="btn btn--ghost btn--sm" disabled={i === 0} onClick={() => moveSlide(i, -1)}>
                  Subir
                </button>
                <button type="button" className="btn btn--ghost btn--sm" disabled={i === hero.length - 1} onClick={() => moveSlide(i, 1)}>
                  Bajar
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm danger"
                  disabled={hero.length === 1}
                  onClick={() => setHero((h) => h.filter((x) => x.id !== s.id))}
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>
        ))}
        {hero.length < 5 && (
          <button
            type="button"
            className="btn btn--ghost"
            style={{ justifySelf: "start" }}
            onClick={() =>
              setHero((h) => [
                ...h,
                { ...h[h.length - 1], id: `h${Date.now()}`, title: "Nuevo título", text: "", image_alt: "" },
              ])
            }
          >
            Agregar otra imagen
          </button>
        )}
      </section>

      <section className="panel">
        <h2>Avisos de la barra superior</h2>
        <p className="panel__hint">Hasta 4 frases cortas. En celulares se muestran de a una.</p>
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            className="input"
            maxLength={90}
            value={announcements[i] ?? ""}
            placeholder={i === 0 ? "Envío gratis desde $150.000" : "Opcional"}
            aria-label={`Aviso ${i + 1}`}
            onChange={(e) =>
              setAnnouncements((a) => {
                const n = [...a];
                n[i] = e.target.value;
                return n.slice(0, 4);
              })
            }
          />
        ))}
      </section>

      <section className="panel">
        <h2>Líneas</h2>
        <p className="panel__hint">Las primeras tres aparecen en el inicio con su foto.</p>
        <div className="images" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {cats.map((c) => (
            <div className="img-tile" key={c.id}>
              <div className="img-tile__pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.image_url && <img src={c.image_url} alt="" />}
              </div>
              <ImageUpload
                folder="lineas"
                demo={demo}
                label="Cambiar foto"
                onUploaded={([f]) => setCats((l) => l.map((x) => (x.id === c.id ? { ...x, image_url: f.url } : x)))}
              />
              <input
                className="input"
                value={c.name}
                maxLength={60}
                aria-label="Nombre de la línea"
                onChange={(e) => setCats((l) => l.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
              />
              <textarea
                className="textarea"
                rows={2}
                style={{ minHeight: 70, fontSize: "var(--t-sm)" }}
                value={c.description}
                maxLength={400}
                aria-label="Descripción de la línea"
                onChange={(e) => setCats((l) => l.map((x) => (x.id === c.id ? { ...x, description: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Bloque de la frase</h2>
        <div className="slide-card">
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            <div className="slide-card__pic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {editorial.image && <img src={editorial.image} alt="" />}
            </div>
            <ImageUpload folder="inicio" demo={demo} label="Cambiar foto" onUploaded={([f]) => setEditorial((e) => ({ ...e, image: f.url }))} />
          </div>
          <div className="form-stack">
            <label className="field">
              <span>Frase grande</span>
              <input className="input" value={editorial.title} maxLength={80} onChange={(e) => setEditorial({ ...editorial, title: e.target.value })} />
            </label>
            <label className="field">
              <span>Texto</span>
              <textarea className="textarea" rows={5} value={editorial.text} maxLength={600} onChange={(e) => setEditorial({ ...editorial, text: e.target.value })} />
            </label>
            <label className="field">
              <span>Descripción de la foto</span>
              <input className="input" value={editorial.image_alt} maxLength={200} onChange={(e) => setEditorial({ ...editorial, image_alt: e.target.value })} />
            </label>
          </div>
        </div>
      </section>

      <div className="savebar">
        <SaveMessage msg={msg} />
        <a href="/" target="_blank" rel="noopener" className="btn btn--ghost">
          Ver el inicio
        </a>
        <button className="btn" disabled={pending} onClick={save}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

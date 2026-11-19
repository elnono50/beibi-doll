"use client";

import { money, PROVINCES, slugify } from "@/lib/format";
import type { ShippingZone } from "@/lib/types";

const num = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;
const kg = (g: number) => (g % 1000 === 0 ? `${g / 1000} kg` : `${g} g`);

/**
 * Tarifas de envío propias (por ejemplo, la tabla de Vía Cargo).
 * Cada tarifa vale para ciertas provincias y tiene precios por escalón de peso.
 */
export function ShippingZones({ zones, onChange }: { zones: ShippingZone[]; onChange: (z: ShippingZone[]) => void }) {
  const upd = (i: number, patch: Partial<ShippingZone>) => onChange(zones.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="zones">
      {zones.map((z, i) => {
        const tiers = [...z.tiers].sort((a, b) => a.max_g - b.max_g);
        const setTiers = (t: ShippingZone["tiers"]) => upd(i, { tiers: t });
        return (
          <article className={`zone${z.enabled ? "" : " zone--off"}`} key={z.id}>
            <div className="zone__head">
              <input
                className="input zone__name"
                value={z.label}
                maxLength={60}
                aria-label="Nombre de la tarifa"
                onChange={(e) => upd(i, { label: e.target.value })}
              />
              <label className="toggle toggle--inline">
                <input type="checkbox" checked={z.enabled} onChange={(e) => upd(i, { enabled: e.target.checked })} />
                <span>Activa</span>
              </label>
            </div>
            <label className="field">
              <span>Plazo o aclaración</span>
              <input className="input" value={z.detail} maxLength={120} onChange={(e) => upd(i, { detail: e.target.value })} />
            </label>

            <div className="zone__tiers">
              <span className="zone__label">Precio según el peso del paquete</span>
              {tiers.map((t, ti) => (
                <div className="tier" key={ti}>
                  <span>Hasta</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={t.max_g}
                    aria-label="Peso máximo en gramos"
                    onChange={(e) => setTiers(tiers.map((x, j) => (j === ti ? { ...x, max_g: num(e.target.value) } : x)))}
                  />
                  <span>g</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={t.price}
                    aria-label={`Precio hasta ${kg(t.max_g)}`}
                    onChange={(e) => setTiers(tiers.map((x, j) => (j === ti ? { ...x, price: num(e.target.value) } : x)))}
                  />
                  <button type="button" className="link" onClick={() => setTiers(tiers.filter((_, j) => j !== ti))}>
                    Quitar
                  </button>
                </div>
              ))}
              <div className="tier">
                <span>{tiers.length ? `Más de ${kg(tiers[tiers.length - 1].max_g)}` : "Precio"}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={z.price}
                  aria-label="Precio base"
                  onChange={(e) => upd(i, { price: num(e.target.value) })}
                />
                <small className="muted">{money(z.price)}</small>
              </div>
              {tiers.length < 10 && (
                <button
                  type="button"
                  className="link"
                  style={{ justifySelf: "start" }}
                  onClick={() =>
                    setTiers([...tiers, { max_g: (tiers[tiers.length - 1]?.max_g ?? 0) + 1000, price: z.price }])
                  }
                >
                  + Agregar escalón de peso
                </button>
              )}
            </div>

            <label className="toggle">
              <input type="checkbox" checked={z.branch} onChange={(e) => upd(i, { branch: e.target.checked })} />
              <span>
                Es retiro en sucursal
                <small>Le pedimos a la clienta en qué sucursal lo retira.</small>
              </span>
            </label>

            <details className="zone__prov">
              <summary>
                Provincias:{" "}
                <b>{z.provinces.length ? z.provinces.join(", ") : "todo el país"}</b>
              </summary>
              <div className="chips">
                {PROVINCES.map((p) => {
                  const on = z.provinces.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      onClick={() => upd(i, { provinces: on ? z.provinces.filter((x) => x !== p) : [...z.provinces, p] })}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <small className="muted">
                Sin provincias marcadas, la tarifa vale para todo el país. Si tu empresa cobra distinto por región, armá una
                tarifa por región y marcá sus provincias.
              </small>
            </details>

            <button type="button" className="link danger" style={{ justifySelf: "start" }} onClick={() => onChange(zones.filter((_, j) => j !== i))}>
              Quitar esta tarifa
            </button>
          </article>
        );
      })}
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ justifySelf: "start" }}
        onClick={() =>
          onChange([
            ...zones,
            {
              id: `tarifa-${slugify(String(Date.now()))}`,
              label: "Nueva tarifa",
              detail: "",
              price: 0,
              enabled: true,
              provinces: [],
              tiers: [],
              branch: false,
            },
          ])
        }
      >
        Agregar tarifa
      </button>
    </div>
  );
}

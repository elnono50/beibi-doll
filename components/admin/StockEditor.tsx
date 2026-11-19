"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveStock } from "@/app/admin/actions";
import { colorsOf, sizesOf } from "@/lib/stock";
import type { Product } from "@/lib/types";
import { Stepper } from "./ProductForm";
import { SaveMessage, useSave } from "./useSave";

export function StockEditor({ products }: { products: Product[] }) {
  const router = useRouter();
  const { pending, msg, run } = useSave();
  const initial = useMemo(() => Object.fromEntries(products.flatMap((p) => p.variants.map((v) => [v.id, v.stock]))), [products]);
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [onlyLow, setOnlyLow] = useState(false);
  const changed = Object.entries(values).filter(([id, s]) => initial[id] !== s);

  const visible = products.filter((p) => !onlyLow || p.variants.some((v) => (values[v.id] ?? v.stock) <= 2));

  return (
    <>
      <section className="panel">
        <label className="toggle">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          <span>Mostrar sólo productos con talles en 2 o menos</span>
        </label>
        {visible.length === 0 && <p className="muted">No hay talles con poco stock.</p>}
        <div className="table-wrap">
          <table className="atable">
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td style={{ width: 220 }}>
                    <div className="prod-cell">
                      <span className="thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.images[0] && <img src={p.images[0].url} alt="" loading="lazy" />}
                      </span>
                      <b style={{ fontWeight: 500 }}>{p.name}</b>
                    </div>
                  </td>
                  <td>
                    {(colorsOf(p).length ? colorsOf(p) : [{ name: "", hex: "" }]).map((c) => {
                      const vs = sizesOf(p, c.name)
                        .map((sz) => p.variants.find((v) => v.color === c.name && v.size === sz))
                        .filter((v): v is NonNullable<typeof v> => Boolean(v));
                      if (!vs.length) return null;
                      return (
                        <div key={c.name || "-"} className="stock-line">
                          <span className="stock-line__color">
                            {c.name && <span className="dot" style={{ background: c.hex }} aria-hidden="true" />}
                            {c.name || "Talles"}
                          </span>
                          {vs.map((v) => (
                            <span key={v.id} className="stock-line__cell">
                              <b>{v.size}</b>
                              <Stepper
                                label={`${p.name} ${c.name} talle ${v.size}`}
                                value={values[v.id] ?? v.stock}
                                onChange={(n) => setValues((x) => ({ ...x, [v.id]: n }))}
                              />
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="savebar">
        <SaveMessage msg={msg ?? (changed.length ? { text: `${changed.length} talles con cambios sin guardar`, tone: "ok" } : null)} />
        <button
          className="btn"
          disabled={pending || changed.length === 0}
          onClick={() =>
            run(
              () => saveStock(changed.map(([id, stock]) => ({ id, delta: stock - initial[id] }))),
              "Stock actualizado",
              () => router.refresh(),
            )
          }
        >
          {pending ? "Guardando…" : "Guardar stock"}
        </button>
      </div>
    </>
  );
}

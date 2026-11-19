"use client";

import { useState } from "react";
import { variantLabel } from "@/lib/stock";
import type { Variant } from "@/lib/types";

export function StockAlert({ soldOut, openByDefault }: { soldOut: Variant[]; openByDefault?: boolean }) {
  const [open, setOpen] = useState(Boolean(openByDefault));
  const [variant, setVariant] = useState(soldOut[0]?.id ?? "");
  const [state, setState] = useState<{ sending?: boolean; done?: string; error?: string }>({});
  if (!soldOut.length) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ sending: true });
    try {
      const res = await fetch("/api/aviso-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          variant_id: variant,
          newsletter: fd.get("newsletter") === "1",
          website: fd.get("website"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setState({ error: data.error || "No pudimos guardar el aviso." });
      else setState({ done: data.message });
    } catch {
      setState({ error: "Se cortó la conexión. Intentá de nuevo." });
    }
  }

  if (!open) {
    return (
      <button type="button" className="link" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
        ¿No está tu talle o color? Te avisamos cuando vuelva
      </button>
    );
  }

  return (
    <div className="stock-alert">
      {state.done ? (
        <p role="status" className="stock-alert__done">
          {state.done}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="stock-alert__form">
          <p className="stock-alert__title">Avisame cuando vuelva</p>
          <div className="hp" aria-hidden="true">
            <input name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <div className="stock-alert__row">
            {soldOut.length > 1 ? (
              <label className="visually-hidden" htmlFor="alert-size">
                Talle
              </label>
            ) : null}
            {soldOut.length > 1 ? (
              <select id="alert-size" className="select input" value={variant} onChange={(e) => setVariant(e.target.value)}>
                {soldOut.map((v) => (
                  <option key={v.id} value={v.id}>
                    {variantLabel(v.color, v.size)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="stock-alert__size">
                {variantLabel(soldOut[0].color, soldOut[0].size)}
              </span>
            )}
            <label className="visually-hidden" htmlFor="alert-email">
              Tu email
            </label>
            <input id="alert-email" className="input" name="email" type="email" inputMode="email" autoComplete="email" placeholder="Tu email" required />
          </div>
          <label className="news__consent">
            <input type="checkbox" name="newsletter" value="1" />
            <span>También quiero recibir novedades y promociones.</span>
          </label>
          {state.error && (
            <p className="field-error" role="alert">
              {state.error}
            </p>
          )}
          <button className="btn btn--ghost" disabled={state.sending} style={{ justifySelf: "start" }}>
            {state.sending ? "Guardando…" : "Avisarme"}
          </button>
          <small className="muted">Te mandamos un solo mail cuando vuelva. Nada más.</small>
        </form>
      )}
    </div>
  );
}

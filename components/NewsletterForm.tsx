"use client";

import Link from "next/link";
import { useState } from "react";
import { useTurnstile } from "@/components/useTurnstile";

export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const cf = useTurnstile("novedades");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");
    if (!fd.get("consent")) return setError("Marcá la casilla para aceptar recibir novedades.");
    setState("sending");
    try {
      const cf_token = await cf.getToken();
      const res = await fetch("/api/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), consent: true, website: fd.get("website"), cf_token }),
      });
      const data = await res.json().catch(() => ({}));
      cf.reset();
      if (!res.ok) {
        setError(data.error || "No pudimos suscribirte. Intentá de nuevo.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Se cortó la conexión. Intentá de nuevo.");
      setState("idle");
    }
  }

  return (
    <section className="news" aria-labelledby="news-title">
      <div className="wrap news__inner">
        <div className="news__copy">
          <h2 id="news-title">Novedades antes que nadie</h2>
          <p>Lanzamientos, reposiciones de talles y promociones. Un mail cada tanto, nada más.</p>
        </div>
        {state === "done" ? (
          <p className="news__done" role="status">
            Listo, ya estás en la lista. Te escribimos con la próxima novedad.
          </p>
        ) : (
          <form className="news__form" onSubmit={onSubmit} noValidate>
            <div className="hp" aria-hidden="true">
              <input name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="news__row">
              <label className="visually-hidden" htmlFor="news-email">
                Tu email
              </label>
              <input
                id="news-email"
                className="input"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Tu email"
                required
              />
              <button className="btn" disabled={state === "sending"}>
                {state === "sending" ? "Sumando…" : "Suscribirme"}
              </button>
            </div>
            <label className="news__consent">
              <input type="checkbox" name="consent" value="1" />
              <span>
                Acepto recibir novedades y promos de Beibi Doll por email. Me puedo dar de baja cuando quiera.{" "}
                <Link href="/ayuda/privacidad">Privacidad</Link>
              </span>
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            {cf.slot}
          </form>
        )}
      </div>
    </section>
  );
}

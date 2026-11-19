"use client";

import { useState } from "react";

export function WithdrawalForm() {
  const [state, setState] = useState<{ code?: string; error?: string; sending?: boolean }>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState({ sending: true });
    try {
      const res = await fetch("/api/arrepentimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(fd.entries())),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setState({ error: data.error || "No pudimos registrar la solicitud. Intentá de nuevo." });
      else setState({ code: data.code });
    } catch {
      setState({ error: "Se cortó la conexión. Intentá de nuevo." });
    }
  }

  if (state.code) {
    return (
      <div className="notice notice--ok" role="status">
        Registramos tu solicitud. Tu código de trámite es <b>{state.code}</b>. Te escribimos dentro de las 24 h hábiles
        para coordinar la devolución.
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={onSubmit} style={{ marginTop: 24 }}>
      <div className="hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="field span-2">
        <span>Número de pedido</span>
        <input className="input" name="order_number" required inputMode="numeric" placeholder="1001" />
      </label>
      <label className="field span-4">
        <span>Nombre y apellido</span>
        <input className="input" name="name" required autoComplete="name" />
      </label>
      <label className="field span-3">
        <span>Email</span>
        <input className="input" name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field span-3">
        <span>Teléfono</span>
        <input className="input" name="phone" type="tel" autoComplete="tel" />
      </label>
      <label className="field span-6">
        <span>Comentario (opcional)</span>
        <textarea className="textarea" name="reason" maxLength={2000} />
      </label>
      {state.error && (
        <p className="notice notice--error span-6" role="alert">
          {state.error}
        </p>
      )}
      <div className="span-6">
        <button className="btn" type="submit" disabled={state.sending}>
          {state.sending ? "Enviando…" : "Enviar solicitud de arrepentimiento"}
        </button>
      </div>
    </form>
  );
}

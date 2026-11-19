"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { flash } from "./flash";

export function PasswordForm({ email, demo }: { email: string; demo: boolean }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const current = String(fd.get("current") ?? "");
    const next = String(fd.get("password") ?? "");
    const again = String(fd.get("confirm") ?? "");
    setMsg("");
    if (demo) return setMsg("En la vista previa no se puede cambiar la contraseña.");
    if (next.length < 10) return setMsg("La contraseña nueva tiene que tener al menos 10 caracteres.");
    if (next !== again) return setMsg("Las contraseñas nuevas no coinciden.");
    if (next === current) return setMsg("Elegí una contraseña distinta a la actual.");
    setBusy(true);
    const sb = browserClient();
    // Confirmamos la contraseña actual antes de cambiarla
    const check = await sb.auth.signInWithPassword({ email, password: current });
    if (check.error) {
      setBusy(false);
      return setMsg("La contraseña actual no es correcta.");
    }
    const { error } = await sb.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return setMsg("No se pudo guardar. Probá con otra contraseña.");
    form.reset();
    flash("Contraseña actualizada");
  }

  return (
    <form className="form-stack" onSubmit={onSubmit} style={{ maxWidth: 420 }}>
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <label className="field">
        <span>Contraseña actual</span>
        <input className="input" name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>Contraseña nueva</span>
        <input className="input" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <small>Mínimo 10 caracteres. Mejor si es una frase que sólo vos conozcas.</small>
      </label>
      <label className="field">
        <span>Repetí la contraseña nueva</span>
        <input className="input" name="confirm" type="password" autoComplete="new-password" required />
      </label>
      {msg && (
        <p className="notice notice--error" role="alert">
          {msg}
        </p>
      )}
      <button className="btn" disabled={busy} style={{ justifySelf: "start" }}>
        {busy ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HangTag } from "@/components/HangTag";
import { isDemo } from "@/lib/config";
import { browserClient } from "@/lib/supabase/browser";

export function ResetForm({ after = "/admin", path = "/admin/restablecer" }: { after?: string; path?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "bad">("checking");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // En la vista previa no hay base conectada: se muestra el formulario sin verificar enlaces
    if (isDemo) {
      setReady("ok");
      return;
    }
    const sb = browserClient();
    const code = new URLSearchParams(window.location.search).get("code");
    (async () => {
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, "", path);
        setReady(error ? "bad" : "ok");
      } else {
        const { data } = await sb.auth.getUser();
        setReady(data.user ? "ok" : "bad");
      }
    })();
  }, [path]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const a = String(fd.get("password") ?? "");
    const b = String(fd.get("confirm") ?? "");
    if (a.length < 10) return setMsg("Usá al menos 10 caracteres.");
    if (a !== b) return setMsg("Las contraseñas no coinciden.");
    if (isDemo) return setMsg("Vista previa: la contraseña no se guarda.");
    setBusy(true);
    const { error } = await browserClient().auth.updateUser({ password: a });
    if (error) {
      setMsg(error.message.includes("different") ? "Elegí una contraseña distinta a la anterior." : "No se pudo guardar. Pedí un enlace nuevo.");
      setBusy(false);
      return;
    }
    router.replace(after);
  }

  return (
    <HangTag className="login__tag-wrap" tagClassName="login__tag">
      <h1>Nueva contraseña</h1>
      {ready === "checking" && <p className="muted">Verificando el enlace…</p>}
      {ready === "bad" && (
        <p className="notice notice--error">
          El enlace venció o se abrió en otro navegador. Pedí uno nuevo desde la pantalla de ingreso y abrilo en este
          mismo navegador.
        </p>
      )}
      {ready === "ok" && (
        <form className="form-stack" onSubmit={onSubmit}>
          <label className="field">
            <span>Contraseña nueva</span>
            <input className="input" name="password" type="password" autoComplete="new-password" minLength={10} required />
            <small>Mínimo 10 caracteres.</small>
          </label>
          <label className="field">
            <span>Repetila</span>
            <input className="input" name="confirm" type="password" autoComplete="new-password" required />
          </label>
          {msg && (
            <p className="notice notice--error" role="alert">
              {msg}
            </p>
          )}
          <button className="btn btn--block" disabled={busy}>
            Guardar contraseña
          </button>
        </form>
      )}
    </HangTag>
  );
}

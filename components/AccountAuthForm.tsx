"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Mode = "login" | "signup" | "reset";

export function AccountAuthForm({ demo, initial = "login" }: { demo: boolean; initial?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initial);
  const [msg, setMsg] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    if (demo) {
      setMsg({ tone: "error", text: "En la vista previa no se pueden crear cuentas." });
      return;
    }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const sb = browserClient();
    setBusy(true);

    if (mode === "login") {
      const { data: signed, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setBusy(false);
      if (error) {
        setMsg({
          tone: "error",
          text: error.message.toLowerCase().includes("confirm")
            ? "Todavía no confirmaste tu email. Buscá el mail que te mandamos (revisá spam)."
            : error.status === 429
              ? "Demasiados intentos. Esperá unos minutos."
              : "El email o la contraseña no coinciden.",
        });
        return;
      }
      // Si es administradora la llevamos al panel (el panel igual vuelve a verificarlo en el servidor)
      const { data: adm } = await sb.from("admins").select("user_id").eq("user_id", signed.user.id).maybeSingle();
      setBusy(false);
      router.replace(adm ? "/admin" : "/cuenta");
      router.refresh();
      return;
    }

    if (mode === "signup") {
      const name = String(fd.get("name") ?? "").trim();
      if (name.length < 2) return (setBusy(false), setMsg({ tone: "error", text: "Contanos tu nombre." }));
      if (password.length < 8) {
        setBusy(false);
        return setMsg({ tone: "error", text: "La contraseña tiene que tener al menos 8 caracteres." });
      }
      if (!fd.get("terms")) {
        setBusy(false);
        return setMsg({ tone: "error", text: "Aceptá los términos y la política de privacidad para crear la cuenta." });
      }
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/cuenta/callback`,
          data: {
            name: name.slice(0, 120),
            phone: String(fd.get("phone") ?? "").trim().slice(0, 40),
            marketing_opt_in: Boolean(fd.get("marketing")),
          },
        },
      });
      setBusy(false);
      if (error) {
        setMsg({
          tone: "error",
          text:
            error.status === 429
              ? "Hubo muchos registros seguidos. Probá en unos minutos."
              : error.message.toLowerCase().includes("password")
                ? "Elegí una contraseña más segura (mezclá letras y números)."
                : "No pudimos crear la cuenta. Revisá el email e intentá de nuevo.",
        });
        return;
      }
      if (data.session) {
        router.replace("/cuenta");
        router.refresh();
        return;
      }
      setMsg({
        tone: "ok",
        text: `Te mandamos un mail a ${email} para confirmar tu cuenta. Abrilo desde este mismo dispositivo.`,
      });
      return;
    }

    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/cuenta/restablecer` });
    setBusy(false);
    setMsg({ tone: "ok", text: "Si hay una cuenta con ese email, te llega un enlace para crear una contraseña nueva." });
  }

  return (
    <div className="auth">
      {mode !== "reset" && (
        <div className="segmented" role="tablist" aria-label="Elegí una opción">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            aria-pressed={mode === "login"}
            onClick={() => (setMode("login"), setMsg(null))}
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            aria-pressed={mode === "signup"}
            onClick={() => (setMode("signup"), setMsg(null))}
          >
            Crear cuenta
          </button>
        </div>
      )}

      <form className="form-stack" onSubmit={onSubmit} key={mode}>
        {mode === "reset" && (
          <p className="muted" style={{ fontSize: "var(--t-sm)" }}>
            Escribí tu email y te mandamos un enlace para elegir una contraseña nueva.
          </p>
        )}
        {mode === "signup" && (
          <label className="field">
            <span>Nombre</span>
            <input className="input" name="name" autoComplete="given-name" maxLength={120} required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input className="input" name="email" type="email" inputMode="email" autoComplete="email" required />
        </label>
        {mode !== "reset" && (
          <label className="field">
            <span>Contraseña</span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            {mode === "signup" && <small>Mínimo 8 caracteres.</small>}
          </label>
        )}
        {mode === "signup" && (
          <>
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} />
            </label>
            <label className="news__consent">
              <input type="checkbox" name="marketing" value="1" />
              <span>Quiero recibir novedades y promociones por email.</span>
            </label>
            <label className="news__consent">
              <input type="checkbox" name="terms" value="1" />
              <span>
                Acepto los <Link href="/ayuda/terminos">términos</Link> y la{" "}
                <Link href="/ayuda/privacidad">política de privacidad</Link>.
              </span>
            </label>
          </>
        )}

        {msg && (
          <p className={`notice notice--${msg.tone}`} role={msg.tone === "error" ? "alert" : "status"}>
            {msg.text}
          </p>
        )}

        <button className="btn btn--block" disabled={busy}>
          {busy
            ? "Un momento…"
            : mode === "login"
              ? "Ingresar"
              : mode === "signup"
                ? "Crear mi cuenta"
                : "Enviar enlace"}
        </button>
      </form>

      <button
        type="button"
        className="link"
        style={{ justifySelf: "center" }}
        onClick={() => (setMode(mode === "reset" ? "login" : "reset"), setMsg(null))}
      >
        {mode === "reset" ? "Volver a ingresar" : "Olvidé mi contraseña"}
      </button>
    </div>
  );
}

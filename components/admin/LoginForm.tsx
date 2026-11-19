"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HangTag } from "@/components/HangTag";
import { browserClient } from "@/lib/supabase/browser";
import { Logo } from "@/components/Logo";
import { useTurnstile } from "@/components/useTurnstile";

export function LoginForm({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [msg, setMsg] = useState<{ text: string; tone: "error" | "ok" } | null>(null);
  const [busy, setBusy] = useState(false);
  const cf = useTurnstile("panel");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (demo) {
      router.push("/admin");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    setBusy(true);
    setMsg(null);
    const sb = browserClient();
    const captchaToken = await cf.getToken();
    cf.reset();
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password: String(fd.get("password") ?? ""),
        options: { captchaToken },
      });
      if (error) {
        setMsg({
          tone: "error",
          text: error.status === 429 ? "Demasiados intentos. Esperá unos minutos." : "El email o la contraseña no coinciden.",
        });
        setBusy(false);
        return;
      }
      // Segundo paso: el código de la app del celular
      router.replace("/admin/2fa");
      router.refresh();
    } else {
      await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/restablecer`, captchaToken });
      // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados
      setMsg({ tone: "ok", text: "Si el email está registrado, te llega un enlace para crear una contraseña nueva." });
      setBusy(false);
    }
  }

  return (
    <HangTag swing className="login__tag-wrap" tagClassName="login__tag">
      <Logo className="pass__brand" eager />
      <h1>{mode === "login" ? "Panel de la tienda" : "Recuperar acceso"}</h1>
      {demo && <p className="notice">Vista previa: entrás sin contraseña y los cambios no se guardan.</p>}
      <form className="form-stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input className="input" name="email" type="email" autoComplete="username" required={!demo} />
        </label>
        {mode === "login" && (
          <label className="field">
            <span>Contraseña</span>
            <input className="input" name="password" type="password" autoComplete="current-password" required={!demo} />
          </label>
        )}
        {msg && (
          <p className={`notice notice--${msg.tone}`} role="alert">
            {msg.text}
          </p>
        )}
        <button className="btn btn--block" disabled={busy}>
          {busy ? "Un momento…" : mode === "login" ? "Ingresar" : "Enviar enlace"}
        </button>
      </form>
      {cf.slot}
      <button
        type="button"
        className="link"
        style={{ justifySelf: "center" }}
        onClick={() => {
          setMode(mode === "login" ? "reset" : "login");
          setMsg(null);
        }}
      >
        {mode === "login" ? "Olvidé mi contraseña" : "Volver a ingresar"}
      </button>
      <Link href="/" className="link" style={{ justifySelf: "center" }}>
        Ir a la tienda
      </Link>
    </HangTag>
  );
}

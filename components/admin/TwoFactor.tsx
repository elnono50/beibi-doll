"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/admin/actions";
import { CopyButton } from "@/components/CopyButton";
import { HangTag } from "@/components/HangTag";
import { Logo } from "@/components/Logo";
import { browserClient } from "@/lib/supabase/browser";

type Step =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string; uri: string }
  | { kind: "error"; text: string };

/** Agrupa la clave en bloques de 4 para copiarla a mano sin errores. */
const groups = (s: string) => s.replace(/(.{4})/g, "$1 ").trim();

export function TwoFactor({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const sb = browserClient();
      const { data, error } = await sb.auth.mfa.listFactors();
      if (error) return setStep({ kind: "error", text: "No pudimos cargar la verificación. Recargá la página." });
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStep({ kind: "verify", factorId: verified.id });

      // Primera vez: limpiamos intentos a medias y vinculamos el celular
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error: enErr } = await sb.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Beibi Doll",
        friendlyName: `Celular ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enErr || !en) return setStep({ kind: "error", text: "No pudimos generar el código QR. Recargá la página." });
      setStep({ kind: "enroll", factorId: en.id, qr: en.totp.qr_code, secret: en.totp.secret, uri: en.totp.uri });
    })();
  }, []);

  async function verify(value: string) {
    if (step.kind !== "verify" && step.kind !== "enroll") return;
    if (!/^\d{6}$/.test(value)) return setMsg("El código tiene 6 números.");
    setBusy(true);
    setMsg("");
    const { error } = await browserClient().auth.mfa.challengeAndVerify({ factorId: step.factorId, code: value });
    if (error) {
      setBusy(false);
      setCode("");
      return setMsg(
        error.status === 429
          ? "Demasiados intentos. Esperá unos minutos."
          : "El código no coincide o ya venció. Probá con el que muestra la app ahora.",
      );
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <HangTag swing className="login__tag-wrap" tagClassName="login__tag mfa">
      <Logo className="pass__brand" eager />

      {step.kind === "loading" && <p className="muted mfa__center">Un momento…</p>}

      {step.kind === "error" && (
        <p className="notice notice--error" role="alert">
          {step.text}
        </p>
      )}

      {step.kind === "verify" && (
        <>
          <h1>Código de verificación</h1>
          <p className="muted mfa__center">
            Abrí la app de verificación de tu celular y escribí el código de 6 números de <b>Beibi Doll</b>.
          </p>
        </>
      )}

      {step.kind === "enroll" && (
        <>
          <h1>Protegé el panel</h1>
          <p className="muted mfa__center">
            Además de la contraseña, el panel va a pedir un código que cambia cada 30 segundos en tu celular. Así nadie
            puede entrar aunque sepa tu contraseña.
          </p>
          <ol className="mfa__steps">
            <li>
              Instalá <b>Google Authenticator</b> o <b>Microsoft Authenticator</b> en tu celular.
            </li>
            <li>
              Tocá <b>+</b> en la app y escaneá este código.
              <span className="mfa__qr">
                {/* eslint-disable-next-line @next/next/no-img-element -- QR generado por Supabase (data URL) */}
                <img src={step.qr} alt="Código QR para vincular la app de verificación" width={184} height={184} />
              </span>
              <span className="mfa__alt">
                <span>
                  ¿Estás en el celular? <a href={step.uri}>Abrilo directo en la app</a> o copiá esta clave en la app:
                </span>
                <span className="mfa__secret">
                  <code>{groups(step.secret)}</code>
                  <CopyButton value={step.secret} label="clave de verificación" />
                </span>
              </span>
            </li>
            <li>Escribí abajo el código de 6 números que te muestra la app.</li>
          </ol>
        </>
      )}

      {(step.kind === "verify" || step.kind === "enroll") && (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            verify(code);
          }}
        >
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
          <label className="field">
            <span>Código de 6 números</span>
            <input
              className="input mfa__code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6 && !busy) verify(v);
              }}
            />
          </label>
          {msg && (
            <p className="notice notice--error" role="alert">
              {msg}
            </p>
          )}
          <button className="btn btn--block" disabled={busy}>
            {busy ? "Verificando…" : step.kind === "enroll" ? "Activar y entrar" : "Entrar al panel"}
          </button>
        </form>
      )}

      <p className="mfa__help">
        ¿Perdiste el celular? Pedile a quien te armó la tienda que reinicie la verificación de tu cuenta.
      </p>
      <form action={signOut} className="mfa__center">
        <button className="link">Salir</button>
      </form>
    </HangTag>
  );
}

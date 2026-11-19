"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Profile = { name: string; phone: string; marketing_opt_in: boolean };

export function AccountProfile({ userId, initial }: { userId: string; initial: Profile }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: Profile, okText: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await browserClient()
      .from("customers")
      .update({ name: next.name.trim().slice(0, 120), phone: next.phone.trim().slice(0, 40), marketing_opt_in: next.marketing_opt_in })
      .eq("user_id", userId);
    setBusy(false);
    if (error) setMsg({ text: "No se pudo guardar. Volvé a ingresar e intentá de nuevo.", tone: "error" });
    else {
      setMsg({ text: okText, tone: "ok" });
      router.refresh();
    }
  }

  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(p, "Datos guardados");
      }}
    >
      <label className="field">
        <span>Nombre</span>
        <input className="input" value={p.name} maxLength={120} autoComplete="name" onChange={(e) => setP({ ...p, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Teléfono</span>
        <input className="input" type="tel" value={p.phone} maxLength={40} autoComplete="tel" onChange={(e) => setP({ ...p, phone: e.target.value })} />
      </label>
      <label className="news__consent">
        <input
          type="checkbox"
          checked={p.marketing_opt_in}
          onChange={(e) => {
            const next = { ...p, marketing_opt_in: e.target.checked };
            setP(next);
            save(next, e.target.checked ? "Listo, vas a recibir novedades" : "Listo, no te mandamos más promociones");
          }}
        />
        <span>Quiero recibir novedades y promociones por email.</span>
      </label>
      {msg && (
        <p className={`notice notice--${msg.tone}`} role="status">
          {msg.text}
        </p>
      )}
      <button className="btn btn--ghost" disabled={busy} style={{ justifySelf: "start" }}>
        {busy ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="link"
      onClick={async () => {
        await browserClient().auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      Cerrar sesión
    </button>
  );
}

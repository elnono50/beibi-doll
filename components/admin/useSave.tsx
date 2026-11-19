"use client";

import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/actions";
import { flash } from "./flash";

export function useSave() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const run = useCallback(
    (fn: () => Promise<ActionResult>, okText = "Cambios guardados", onOk?: (r: ActionResult) => void) => {
      setMsg(null);
      start(async () => {
        const r = await fn();
        if (r.ok) {
          const text = r.notice ?? okText;
          setMsg({ text, tone: "ok" });
          flash(r.notice ? "Envío en curso" : okText);
          onOk?.(r);
          // los avisos largos quedan a la vista; los "guardado" se van solos
          if (!r.notice) window.setTimeout(() => setMsg((m) => (m?.tone === "ok" ? null : m)), 3500);
        } else setMsg({ text: r.error, tone: "error" });
      });
    },
    [],
  );
  return { pending, msg, run, setMsg };
}

export function SaveMessage({ msg }: { msg: { text: string; tone: "ok" | "error" } | null }) {
  return (
    <span
      className="savebar__msg"
      role="status"
      aria-live="polite"
      style={{ color: msg?.tone === "error" ? "var(--error)" : msg ? "var(--ok)" : undefined }}
    >
      {msg?.text ?? ""}
    </span>
  );
}

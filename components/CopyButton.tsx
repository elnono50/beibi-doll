"use client";

import { useState } from "react";
import { CopyIcon } from "./Icons";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          /* sin permiso de portapapeles */
        }
      }}
    >
      {done ? <span style={{ fontSize: "var(--t-xs)" }}>Copiado</span> : <CopyIcon />}
    </button>
  );
}

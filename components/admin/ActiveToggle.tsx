"use client";

import { useOptimistic, useTransition } from "react";
import { setProductActive } from "@/app/admin/actions";
import { flash } from "./flash";

export function ActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(active);
  return (
    <label className="toggle" title={value ? "Visible" : "Oculto"}>
      <input
        type="checkbox"
        checked={value}
        disabled={pending}
        aria-label={`${name} visible en la tienda`}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setValue(next);
            const r = await setProductActive(id, next);
            if (!r.ok) flash(r.error, "error");
          });
        }}
      />
    </label>
  );
}

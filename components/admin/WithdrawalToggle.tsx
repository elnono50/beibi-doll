"use client";

import { useOptimistic, useTransition } from "react";
import { setWithdrawalHandled } from "@/app/admin/actions";
import { flash } from "./flash";

export function WithdrawalToggle({ id, handled }: { id: string; handled: boolean }) {
  const [pending, start] = useTransition();
  const [v, setV] = useOptimistic(handled);
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={v}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          start(async () => {
            setV(next);
            const r = await setWithdrawalHandled(id, next);
            if (!r.ok) flash(r.error, "error");
          });
        }}
      />
      <span>{v ? "Resuelta" : "Pendiente"}</span>
    </label>
  );
}

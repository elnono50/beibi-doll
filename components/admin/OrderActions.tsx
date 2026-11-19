"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveOrderMeta, setOrderStatus } from "@/app/admin/actions";
import type { Order } from "@/lib/types";
import { SaveMessage, useSave } from "./useSave";

export function OrderActions({ order }: { order: Order }) {
  const router = useRouter();
  const { pending, msg, run } = useSave();
  const [tracking, setTracking] = useState(order.tracking_code ?? "");
  const [notes, setNotes] = useState(order.admin_notes ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const go = (status: string, ok: string) => run(() => setOrderStatus(order.id, status), ok, () => router.refresh());
  const st = order.status;
  const pickup = order.shipping_method === "pickup";

  return (
    <section className="panel">
      <h2>Qué sigue</h2>
      <div className="actions-row">
        {pickup ? (
          <>
            {(st === "pending" || st === "expired") && order.payment_method !== "cash" && (
              <button className="btn" disabled={pending} onClick={() => go("paid", "Pago confirmado")}>
                Confirmar que recibí el pago
              </button>
            )}
            {(st === "paid" || (st === "pending" && order.payment_method === "cash")) && (
              <button className="btn" disabled={pending} onClick={() => go("preparing", "Le avisamos que está listo")}>
                Avisar que está listo para retirar
              </button>
            )}
            {(st === "paid" || st === "preparing" || (order.payment_method === "cash" && (st === "pending" || st === "expired"))) && (
              <button
                className={st === "preparing" ? "btn" : "btn btn--ghost"}
                disabled={pending}
                onClick={() => go("delivered", "Pedido retirado")}
              >
                {order.payment_method === "cash" ? "Pagó y lo retiró" : "Marcar como retirado"}
              </button>
            )}
          </>
        ) : (
          <>
            {(st === "pending" || st === "expired") && (
              <button className="btn" disabled={pending} onClick={() => go("paid", "Pago confirmado")}>
                Confirmar que recibí el pago
              </button>
            )}
            {st === "paid" && (
              <button className="btn btn--ghost" disabled={pending} onClick={() => go("preparing", "Pedido en preparación")}>
                Empezar a preparar
              </button>
            )}
            {(st === "paid" || st === "preparing") && (
              <button
                className="btn"
                disabled={pending}
                onClick={() =>
                  run(
                    async () => {
                      const a = await saveOrderMeta(order.id, tracking, notes);
                      if (!a.ok) return a;
                      return setOrderStatus(order.id, "shipped");
                    },
                    "Pedido marcado como enviado. Le llegó un mail con el seguimiento.",
                    () => router.refresh(),
                  )
                }
              >
                Marcar como enviado
              </button>
            )}
            {st === "shipped" && (
              <button className="btn" disabled={pending} onClick={() => go("delivered", "Pedido entregado")}>
                Marcar como entregado
              </button>
            )}
          </>
        )}
      </div>
      {pickup && st === "preparing" && (
        <p className="notice">Le avisamos por mail que está listo. Cuando lo retire, marcalo como retirado.</p>
      )}
      {!pickup && (st === "paid" || st === "preparing") && (
        <p className="muted" style={{ fontSize: "var(--t-sm)" }}>
          Cargá el código de seguimiento antes de marcarlo como enviado: le llega a la clienta en el mail.
        </p>
      )}
      {st === "expired" && (
        <p className="notice">
          La reserva venció y el stock volvió a la tienda. Si igual te pagó, confirmá el pago: el sistema vuelve a tomar
          las unidades si todavía hay.
        </p>
      )}

      {order.shipping_method === "delivery" && st !== "cancelled" && (
        <label className="field">
          <span>Código de seguimiento</span>
          <input className="input" value={tracking} maxLength={120} onChange={(e) => setTracking(e.target.value)} />
          <small>La clienta lo ve en la página de su pedido.</small>
        </label>
      )}
      <label className="field">
        <span>Notas internas</span>
        <textarea className="textarea" value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} />
        <small>Sólo las ves vos.</small>
      </label>
      <div className="actions-row" style={{ alignItems: "center" }}>
        <button
          className="btn btn--ghost btn--sm"
          disabled={pending}
          onClick={() => run(() => saveOrderMeta(order.id, tracking, notes), "Notas guardadas", () => router.refresh())}
        >
          Guardar notas
        </button>
        <SaveMessage msg={msg} />
      </div>

      {["pending", "paid", "preparing"].includes(st) && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, display: "grid", gap: 10 }}>
          {confirmCancel ? (
            <>
              <p style={{ fontSize: "var(--t-sm)" }}>
                Al cancelar, las unidades vuelven al stock.
                {st !== "pending" && order.payment_method === "mercadopago"
                  ? " La devolución del dinero se hace desde tu cuenta de Mercado Pago."
                  : ""}
              </p>
              <div className="actions-row">
                <button className="btn danger" disabled={pending} onClick={() => go("cancelled", "Pedido cancelado")}>
                  Sí, cancelar pedido
                </button>
                <button className="btn btn--ghost" onClick={() => setConfirmCancel(false)}>
                  No
                </button>
              </div>
            </>
          ) : (
            <button className="link" style={{ justifySelf: "start", color: "var(--error)" }} onClick={() => setConfirmCancel(true)}>
              Cancelar pedido
            </button>
          )}
        </div>
      )}
    </section>
  );
}

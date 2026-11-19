"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { money } from "@/lib/format";
import { variantLabel } from "@/lib/stock";
import { useCart } from "./CartProvider";
import { CloseIcon } from "./Icons";


export function FreeShipping({ subtotal, freeFrom }: { subtotal: number; freeFrom: number | null }) {
  if (!freeFrom || freeFrom <= 0) return null;
  const left = freeFrom - subtotal;
  const pct = Math.min(100, (subtotal / freeFrom) * 100);
  return (
    <div className="free-ship">
      <span>{left > 0 ? `Te faltan ${money(left)} para el envío gratis` : "Tu envío es gratis"}</span>
      <div className="free-ship__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer({ freeFrom }: { freeFrom: number | null }) {
  const { open, setOpen, lines, setQty, remove, subtotal } = useCart();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="bag-title" ref={panel} tabIndex={-1}>
        <div className="drawer__head">
          <h2 id="bag-title">Tu bolsa</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar bolsa">
            <CloseIcon />
          </button>
        </div>

        <div className="drawer__body">
          {lines.length === 0 ? (
            <div className="empty">
              <p>Todavía no agregaste nada.</p>
              <Link href="/tienda" className="btn btn--ghost" onClick={() => setOpen(false)}>
                Ver la tienda
              </Link>
            </div>
          ) : (
            lines.map((l) => (
              <div className="line" key={l.key}>
                <div className="line__img">
                  {l.image && <Image src={l.image} alt="" fill sizes="76px" />}
                </div>
                <div className="line__info">
                  <div className="line__top">
                    <Link href={`/producto/${l.slug}`} className="line__name" onClick={() => setOpen(false)}>
                      {l.name}
                    </Link>
                    <span className="price">{money(l.unit_price * l.quantity)}</span>
                  </div>
                  <span className="line__meta">{variantLabel(l.color, l.size)}</span>
                  <div className="line__actions">
                    <div className="qty qty--sm" role="group" aria-label={`Cantidad de ${l.name}`}>
                      <button onClick={() => setQty(l.key, l.quantity - 1)} disabled={l.quantity <= 1} aria-label="Restar uno">
                        −
                      </button>
                      <output aria-live="polite">{l.quantity}</output>
                      <button onClick={() => setQty(l.key, l.quantity + 1)} aria-label="Sumar uno">
                        +
                      </button>
                    </div>
                    <button className="link" onClick={() => remove(l.key)}>
                      Quitar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="drawer__foot">
            <FreeShipping subtotal={subtotal} freeFrom={freeFrom} />
            <div className="sum-row sum-row--total">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <Link href="/checkout" className="btn btn--block" onClick={() => setOpen(false)}>
              Finalizar compra
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

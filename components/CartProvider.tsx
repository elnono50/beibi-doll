"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CartLine } from "@/lib/types";

type Toast = { id: number; text: string; tone?: "error" };

type Ctx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (line: Omit<CartLine, "key">, max: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toast: (text: string, tone?: "error") => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "beibidoll:bolsa:v1";
const MAX_PER_LINE = 10;

export const lineKey = (l: Pick<CartLine, "variant_id">) => l.variant_id;

function isLine(x: unknown): x is CartLine {
  if (!x || typeof x !== "object") return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.variant_id === "string" &&
    typeof l.product_id === "string" &&
    typeof l.name === "string" &&
    typeof l.slug === "string" &&
    typeof l.size === "string" &&
    typeof l.color === "string" &&
    typeof l.unit_price === "number" &&
    Number.isInteger(l.quantity) &&
    (l.quantity as number) > 0
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const maxRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed.filter(isLine).slice(0, 30));
      }
    } catch {
      /* almacenamiento no disponible: la bolsa vive en memoria */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* ignorar */
    }
  }, [lines, ready]);

  const toast = useCallback((text: string, tone?: "error") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const add = useCallback<Ctx["add"]>((line, max) => {
    const key = lineKey(line);
    const cap = Math.max(0, Math.min(max, MAX_PER_LINE));
    maxRef.current[key] = cap;
    setLines((prev) => {
      const found = prev.find((l) => l.key === key);
      if (found) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(cap, l.quantity + line.quantity) } : l,
        );
      }
      return [...prev, { ...line, key, quantity: Math.min(cap, line.quantity) }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    const cap = maxRef.current[key] ?? MAX_PER_LINE;
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(cap, qty)) } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((p) => p.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<Ctx>(
    () => ({
      lines,
      ready,
      count: lines.reduce((a, l) => a + l.quantity, 0),
      subtotal: lines.reduce((a, l) => a + l.quantity * l.unit_price, 0),
      open,
      setOpen,
      add,
      setQty,
      remove,
      clear,
      toast,
    }),
    [lines, ready, open, add, setQty, remove, clear, toast],
  );

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.tone === "error" ? " toast--error" : ""}`}>
            {t.text}
          </div>
        ))}
      </div>
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart fuera de CartProvider");
  return c;
}

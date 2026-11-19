"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile en modo invisible: sólo muestra un recuadro si
 * Cloudflare sospecha de un bot. Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY no hace nada.
 *
 * const { slot, getToken, reset } = useTurnstile();
 * <form>…{slot}</form>  ·  const cf_token = await getToken();  ·  después de enviar: reset()
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
  getResponse: (id: string) => string | undefined;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loader: Promise<TurnstileApi> | null = null;
function loadApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
      s.onerror = () => {
        loader = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export function useTurnstile(action = "form") {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string>("");
  const waiters = useRef<((t: string) => void)[]>([]);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let alive = true;
    loadApi()
      .then((api) => {
        if (!alive || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: SITE_KEY,
          action,
          appearance: "interaction-only",
          theme: "dark",
          language: "es",
          "refresh-expired": "auto",
          callback: (t: string) => {
            token.current = t;
            waiters.current.splice(0).forEach((w) => w(t));
          },
          "expired-callback": () => (token.current = ""),
          "error-callback": () => {
            token.current = "";
            return true;
          },
        });
      })
      .catch(() => {
        /* sin red a Cloudflare: el servidor decide */
      });
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [action]);

  /** Devuelve el token (espera hasta 10 s si todavía se está generando). */
  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    if (token.current) return token.current;
    return new Promise((resolve) => {
      const t = window.setTimeout(() => resolve(undefined), 10_000);
      waiters.current.push((v) => {
        window.clearTimeout(t);
        resolve(v);
      });
    });
  }, []);

  /** Cada token sirve una sola vez: pedir uno nuevo después de cada envío. */
  const reset = useCallback(() => {
    token.current = "";
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, []);

  const slot = SITE_KEY ? <div ref={box} className="cf-box" /> : null;
  return { slot, getToken, reset, enabled: Boolean(SITE_KEY) };
}

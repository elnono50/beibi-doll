"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlide } from "@/lib/types";

const DURATION = 6500;

/**
 * Carrusel de portada: fotos a pantalla completa que van pasando solas.
 * Se pausa al pasar el mouse, al enfocar con teclado o con el botón de pausa,
 * se puede deslizar con el dedo y respeta "reducir movimiento".
 */
export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);
  const running = n > 1 && !paused && !hover && !reduced;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(i + 1);
    }, DURATION);
    return () => window.clearTimeout(t);
  }, [i, running, go]);

  if (!n) return null;

  return (
    <section
      className="hero"
      aria-roledescription="carrusel"
      aria-label="Destacados"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 48) go(i + (dx < 0 ? 1 : -1));
        touch.current = null;
      }}
    >
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className={`hero__slide${idx === i ? " is-on" : ""}`}
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${idx + 1} de ${n}`}
          aria-hidden={idx !== i}
        >
          <div className="hero__img">
            <Image src={s.image} alt={s.image_alt} fill priority={idx === 0} sizes="100vw" />
          </div>
          <div className="hero__copy wrap">
            <h2 className="hero__title">{s.title}</h2>
            {s.text && <p className="hero__text">{s.text}</p>}
            {s.cta_label && (
              <Link href={s.cta_href || "/tienda"} className="btn" tabIndex={idx === i ? 0 : -1}>
                {s.cta_label}
              </Link>
            )}
          </div>
        </div>
      ))}

      {n > 1 && (
        <div className="hero__controls wrap">
          <div className="hero__bars">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className="hero__bar"
                aria-label={`Ver ${idx + 1} de ${n}: ${s.title}`}
                aria-current={idx === i}
                onClick={() => go(idx)}
              >
                <span
                  key={`${idx}-${i}-${running}`}
                  className={idx < i ? "is-done" : idx === i ? (running ? "is-running" : "is-done") : ""}
                  style={{ animationDuration: `${DURATION}ms` }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="hero__pause"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Reanudar el carrusel" : "Pausar el carrusel"}
          >
            {paused ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      )}
    </section>
  );
}

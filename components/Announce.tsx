"use client";

import { useEffect, useState } from "react";

export function Announce({ items }: { items: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 4200);
    return () => window.clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  return (
    <div className="announce">
      <div className="wrap announce__inner">
        {items.map((text, idx) => (
          <p key={idx} className={`announce__item${idx === i ? " is-on" : ""}`}>
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}

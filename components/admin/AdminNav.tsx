"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; count?: number };

export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname();
  return (
    <ul className="admin-nav">
      {items.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        return (
          <li key={it.href}>
            <Link href={it.href} aria-current={active ? "page" : undefined}>
              {it.label}
              {it.count ? <span className="count">{it.count}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "./CartProvider";
import { BagIcon, CloseIcon, MenuIcon, UserIcon } from "./Icons";
import { useCustomer } from "./useCustomer";

type NavItem = { href: string; label: string };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname + (params.get("categoria") ? `?categoria=${params.get("categoria")}` : "");
  return (
    <>
      {items.map((it) => (
        <li key={it.href}>
          <Link href={it.href} aria-current={current === it.href ? "page" : undefined} onClick={onNavigate}>
            {it.label}
          </Link>
        </li>
      ))}
    </>
  );
}

export function Header({ nav, whatsapp, instagram }: { nav: NavItem[]; whatsapp: string; instagram: string }) {
  const { count, setOpen, ready } = useCart();
  const customer = useCustomer();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);
  useEffect(() => setMenu(false), [pathname]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const accountLabel = customer.loggedIn ? "Mi cuenta" : "Ingresar";
  const close = () => setMenu(false);

  // El menú se monta en <body>: dentro del header el desenfoque de fondo
  // lo encerraba en los 64 px de alto y se veía transparente.
  const mobileMenu = (
    <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Menú">
      <div className="mobile-nav__top">
        <Link href="/" className="logo brand-script" onClick={close} aria-label="Beibi Doll, inicio">
          Beibi.doll
        </Link>
        <button className="icon-btn" aria-label="Cerrar menú" onClick={close} autoFocus>
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Menú principal" className="mobile-nav__body">
        <ul className="mobile-nav__main">
          <Suspense fallback={null}>
            <NavLinks items={[{ href: "/", label: "Inicio" }, ...nav]} onNavigate={close} />
          </Suspense>
        </ul>
        <Link href={customer.loggedIn ? "/cuenta" : "/cuenta/ingresar"} className="mobile-nav__account" onClick={close}>
          <UserIcon />
          <span>
            {accountLabel}
            <small>{customer.loggedIn ? customer.email : "Creá tu cuenta y recibí novedades y promociones"}</small>
          </span>
        </Link>
      </nav>
      <div className="mobile-nav__foot">
        <Link href="/ayuda/envios" onClick={close}>
          Envíos y pagos
        </Link>
        <Link href="/ayuda/cambios" onClick={close}>
          Cambios y devoluciones
        </Link>
        <Link href="/ayuda/talles" onClick={close}>
          Guía de talles
        </Link>
        {instagram && (
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer">
            Instagram @{instagram}
          </a>
        )}
        {whatsapp && (
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );

  return (
    <header className={`header${scrolled ? " is-scrolled" : ""}`}>
      <div className="wrap header__inner">
        <nav aria-label="Principal">
          <ul className="header__nav" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <Suspense fallback={null}>
              <NavLinks items={nav} />
            </Suspense>
          </ul>
          <button className="icon-btn menu-btn" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}>
            <MenuIcon />
          </button>
        </nav>

        <Link href="/" className="logo brand-script" aria-label="Beibi Doll, inicio">
          Beibi.doll
        </Link>

        <div className="header__actions">
          <Link
            href={customer.loggedIn ? "/cuenta" : "/cuenta/ingresar"}
            className="icon-btn account-btn"
            aria-label={accountLabel}
          >
            <span className="bag-label">{accountLabel}</span>
            <UserIcon />
          </Link>
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label={`Abrir bolsa, ${count} productos`}>
            <span className="bag-label">Bolsa</span>
            <BagIcon />
            {ready && count > 0 && <span className="bag-count">{count}</span>}
          </button>
        </div>
      </div>

      {menu && mounted && createPortal(mobileMenu, document.body)}
    </header>
  );
}

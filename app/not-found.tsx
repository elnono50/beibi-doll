import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="wrap" style={{ minHeight: "80svh", display: "grid", alignContent: "center", gap: 20 }}>
      <Link href="/" className="logo" style={{ justifySelf: "start" }} aria-label="Beibi Doll, inicio">
        <Logo alt="" eager />
      </Link>
      <h1 style={{ fontSize: "clamp(3rem, 2rem + 6vw, 7rem)", lineHeight: 0.92 }}>Esta página no existe</h1>
      <p style={{ color: "var(--sea-soft)" }}>El enlace puede estar mal escrito o la página ya no existe.</p>
      <Link href="/tienda" className="btn" style={{ justifySelf: "start" }}>
        Ir a la tienda
      </Link>
    </main>
  );
}

import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/AdminNav";
import { adminCounts } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();

  const counts = await adminCounts(admin.supabase);
  const items = [
    { href: "/admin", label: "Resumen" },
    { href: "/admin/pedidos", label: "Pedidos", count: counts.toPrepare },
    { href: "/admin/productos", label: "Productos" },
    { href: "/admin/stock", label: "Stock" },
    { href: "/admin/inicio", label: "Página de inicio" },
    { href: "/admin/ajustes", label: "Envíos y pagos" },
    { href: "/admin/novedades", label: "Novedades" },
    { href: "/admin/arrepentimientos", label: "Arrepentimientos", count: counts.withdrawals },
    { href: "/admin/cuenta", label: "Mi cuenta" },
  ];

  return (
    <div className="admin">
      <aside className="admin-side">
        <Link href="/admin" className="logo">
          <Logo alt="Beibi Doll" eager />
          <small>Panel de la tienda</small>
        </Link>
        <nav aria-label="Panel">
          <AdminNav items={items} />
        </nav>
        <div className="admin-side__foot">
          <span>{admin.demo ? "Vista previa: no se guardan cambios" : admin.email}</span>
          <a href="/" target="_blank" rel="noopener">
            Ver la tienda
          </a>
          {!admin.demo && (
            <form action={signOut}>
              <button type="submit">Salir</button>
            </form>
          )}
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { adminCategories, adminProducts } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Productos" };

type Props = { searchParams: Promise<{ linea?: string; q?: string }> };

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await getAdmin();
  const [products, categories] = await Promise.all([adminProducts(admin.supabase), adminCategories(admin.supabase)]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const list = products.filter(
    (p) => (!sp.linea || p.category?.slug === sp.linea) && (!q || p.name.toLowerCase().includes(q)),
  );

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Productos</h1>
          <p>
            {products.length} productos, {products.filter((p) => p.active).length} visibles en la tienda.
          </p>
        </div>
        <div className="admin-head__actions">
          <Link href="/admin/stock" className="btn btn--ghost">
            Reponer stock
          </Link>
          <Link href="/admin/productos/nuevo" className="btn">
            Nuevo producto
          </Link>
        </div>
      </div>

      <section className="panel">
        <form className="toolbar" style={{ margin: 0, borderTop: 0, paddingTop: 0 }} role="search">
          <div className="tabs">
            <Link href="/admin/productos" className="chip" aria-current={!sp.linea ? "page" : undefined}>
              Todas
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={`/admin/productos?linea=${c.slug}`} className="chip" aria-current={sp.linea === c.slug ? "page" : undefined}>
                {c.name}
              </Link>
            ))}
          </div>
          {sp.linea && <input type="hidden" name="linea" value={sp.linea} />}
          <input className="input" name="q" defaultValue={sp.q} placeholder="Buscar por nombre" aria-label="Buscar producto" style={{ maxWidth: 260, minHeight: 40 }} />
        </form>

        {list.length === 0 ? (
          <div className="empty-state">
            <p>{products.length ? "No hay productos con ese filtro." : "Todavía no cargaste productos."}</p>
            <Link href="/admin/productos/nuevo" className="btn">
              Cargar el primero
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Visible</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const total = p.variants.reduce((a, v) => a + v.stock, 0);
                  const empty = p.variants.filter((v) => v.stock === 0).length;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/productos/${p.id}`} className="prod-cell">
                          <span className="thumb">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {p.images[0] && <img src={p.images[0].url} alt="" loading="lazy" />}
                          </span>
                          <span>
                            <b style={{ fontWeight: 500 }}>{p.name}</b>
                            <br />
                            <span className="muted">
                              {p.category?.name ?? "Sin línea"}
                              {p.featured ? ", destacado" : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {money(p.price)}
                        {p.compare_at_price ? (
                          <>
                            <br />
                            <s className="muted">{money(p.compare_at_price)}</s>
                          </>
                        ) : null}
                      </td>
                      <td>
                        {total} unidades
                        {empty > 0 && (
                          <>
                            <br />
                            <span style={{ color: "var(--error)", fontSize: "var(--t-xs)" }}>
                              {empty} {empty === 1 ? "talle agotado" : "talles agotados"}
                            </span>
                          </>
                        )}
                      </td>
                      <td>
                        <ActiveToggle id={p.id} active={p.active} name={p.name} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

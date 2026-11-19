import type { Metadata } from "next";
import { StockEditor } from "@/components/admin/StockEditor";
import Link from "next/link";
import { adminProducts, adminStockDemand, releaseExpired } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const admin = await getAdmin();
  await releaseExpired(admin.supabase);
  const [products, demand] = await Promise.all([adminProducts(admin.supabase), adminStockDemand(admin.supabase)]);
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Stock</h1>
          <p>Cada venta descuenta sola. Cuando entra mercadería, sumá las unidades acá y guardá.</p>
        </div>
      </div>
      {demand.length > 0 && (
        <section className="panel">
          <h2>Talles que te están pidiendo</h2>
          <p className="panel__hint">
            Clientas que tocaron “Avisame cuando vuelva”. Cuando repongas y guardes, les llega un mail automático.
          </p>
          <table className="atable">
            <tbody>
              {demand.map((d) => (
                <tr key={d.productId + d.label}>
                  <td>
                    <Link href={`/admin/productos/${d.productId}`}>{d.product}</Link>
                  </td>
                  <td className="muted">{d.label}</td>
                  <td style={{ fontWeight: 500 }}>
                    {d.count} {d.count === 1 ? "persona" : "personas"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <StockEditor key={products.map((p) => p.variants.map((v) => v.stock).join()).join("|")} products={products} />
    </>
  );
}

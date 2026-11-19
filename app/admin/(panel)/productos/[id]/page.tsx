import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { adminCategories, adminProduct } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Editar producto" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin();
  const [product, categories] = await Promise.all([adminProduct(admin.supabase, id), adminCategories(admin.supabase)]);
  if (!product) notFound();
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>{product.name}</h1>
          <p>{product.active ? "Visible en la tienda" : "Oculto"}</p>
        </div>
        {product.active && (
          <Link href={`/producto/${product.slug}`} target="_blank" className="btn btn--ghost">
            Ver en la tienda
          </Link>
        )}
      </div>
      <ProductForm key={`${product.id}:${product.updated_at ?? ""}`} product={product} categories={categories} demo={admin.demo} />
    </>
  );
}

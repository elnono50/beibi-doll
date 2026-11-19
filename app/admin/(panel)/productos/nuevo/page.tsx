import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { adminCategories } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NewProduct() {
  const admin = await getAdmin();
  const categories = await adminCategories(admin.supabase);
  return (
    <>
      <div className="admin-head">
        <h1>Nuevo producto</h1>
      </div>
      <ProductForm product={null} categories={categories} demo={admin.demo} />
    </>
  );
}

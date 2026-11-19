import type { Metadata } from "next";
import { HomeEditor } from "@/components/admin/HomeEditor";
import { adminCategories, adminSettings } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Página de inicio" };

export default async function HomeAdmin() {
  const admin = await getAdmin();
  const [settings, categories] = await Promise.all([adminSettings(admin.supabase), adminCategories(admin.supabase)]);
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Página de inicio</h1>
          <p>Fotos, textos y avisos que se ven al entrar a la tienda.</p>
        </div>
      </div>
      <HomeEditor settings={settings} categories={categories} demo={admin.demo} />
    </>
  );
}

import type { Metadata } from "next";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { adminSettings } from "@/lib/admin-data";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Envíos y pagos" };

export default async function SettingsPage() {
  const admin = await getAdmin();
  const settings = await adminSettings(admin.supabase);
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Envíos y pagos</h1>
          <p>Precios de envío, datos para transferir, contacto y guía de talles.</p>
        </div>
      </div>
      <SettingsForm settings={settings} mpReady={Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_WEBHOOK_SECRET)} />
    </>
  );
}

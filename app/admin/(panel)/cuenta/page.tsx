import type { Metadata } from "next";
import { PasswordForm } from "@/components/admin/PasswordForm";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const admin = await getAdmin();
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Mi cuenta</h1>
          <p>Ingresás como {admin.email}.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Cambiar contraseña</h2>
        <PasswordForm email={admin.email} demo={admin.demo} />
      </section>
    </>
  );
}

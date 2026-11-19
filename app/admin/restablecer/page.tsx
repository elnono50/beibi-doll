import type { Metadata } from "next";
import { ResetForm } from "@/components/admin/ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function ResetPage() {
  return (
    <main className="login">
      <ResetForm />
    </main>
  );
}

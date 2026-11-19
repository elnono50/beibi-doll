import type { Metadata } from "next";
import { ResetForm } from "@/components/admin/ResetForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default function CustomerReset() {
  return (
    <section className="tag-stage">
      <ResetForm after="/cuenta" path="/cuenta/restablecer" />
    </section>
  );
}

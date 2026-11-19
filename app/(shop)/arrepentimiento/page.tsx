import type { Metadata } from "next";
import { WithdrawalForm } from "@/components/WithdrawalForm";

export const metadata: Metadata = { title: "Botón de arrepentimiento" };

export default function Page() {
  return (
    <div className="wrap">
      <article className="prose">
        <h1>Botón de arrepentimiento</h1>
        <p>
          Tenés 10 días corridos desde que recibiste tu compra para arrepentirte, sin costo y sin dar explicaciones
          (Ley 24.240, art. 34, y Resolución 424/2020). Completá el formulario y te damos un código de trámite en el
          momento.
        </p>
        <WithdrawalForm />
      </article>
    </div>
  );
}

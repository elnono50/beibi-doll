import type { Metadata } from "next";
import { CheckoutForm } from "@/components/CheckoutForm";
import { isDemo } from "@/lib/config";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function CheckoutPage() {
  const settings = await getSettings();
  return (
    <div className="wrap">
      <CheckoutForm settings={settings} demo={isDemo} />
    </div>
  );
}

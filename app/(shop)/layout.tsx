import { Announce } from "@/components/Announce";
import { CartDrawer } from "@/components/CartDrawer";
import { CartProvider } from "@/components/CartProvider";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { NewsletterForm } from "@/components/NewsletterForm";
import { isDemo } from "@/lib/config";
import { getCategories, getSettings } from "@/lib/data";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const nav = [
    ...categories.map((c) => ({ href: `/tienda?categoria=${c.slug}`, label: c.name })),
    { href: "/tienda", label: "Ver todo" },
  ];
  return (
    <CartProvider>
      <a href="#contenido" className="skip-link">
        Ir al contenido
      </a>
      {isDemo && (
        <div className="demo-banner">
          Vista previa con productos y fotos de muestra. Las compras no se procesan.
        </div>
      )}
      <Announce items={settings.announcements.filter(Boolean)} />
      <Header nav={nav} whatsapp={settings.contact.whatsapp} instagram={settings.contact.instagram} />
      <main id="contenido">{children}</main>
      <NewsletterForm />
      <Footer settings={settings} categories={categories} />
      <CartDrawer freeFrom={settings.shipping.free_from} />
    </CartProvider>
  );
}

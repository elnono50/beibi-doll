import Link from "next/link";
import type { Category, Settings } from "@/lib/types";

export function Footer({ settings, categories }: { settings: Settings; categories: Category[] }) {
  const { contact, legal } = settings;
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="footer__brand">
            <span className="logo brand-script">Beibi.doll</span>
            <p>{settings.tagline ? `${settings.tagline.replace(/\.$/, "")}.` : "Ropa con actitud."} Local en San Juan, envíos a todo el país.</p>
          </div>
          <div>
            <h3>Tienda</h3>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/tienda?categoria=${c.slug}`}>{c.name}</Link>
                </li>
              ))}
              <li>
                <Link href="/tienda">Ver todo</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Ayuda</h3>
            <ul>
              <li>
                <Link href="/ayuda/envios">Envíos y pagos</Link>
              </li>
              <li>
                <Link href="/ayuda/cambios">Cambios y devoluciones</Link>
              </li>
              <li>
                <Link href="/ayuda/talles">Guía de talles</Link>
              </li>
              <li>
                <Link href="/ayuda/terminos">Términos y condiciones</Link>
              </li>
              <li>
                <Link href="/ayuda/privacidad">Privacidad</Link>
              </li>
            </ul>
          </div>
          <div>
            <h3>Contacto</h3>
            <ul>
              {contact.whatsapp && (
                <li>
                  <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </li>
              )}
              {contact.instagram && (
                <li>
                  <a href={`https://instagram.com/${contact.instagram}`} target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              )}
              {contact.city && <li>{contact.city}</li>}
            </ul>
          </div>
        </div>

        <div className="footer__word" aria-hidden="true">
          Beibi Doll
        </div>

        <div className="footer__legal">
          <span>
            © {year} {legal.business_name || "Beibi Doll"}
            {legal.cuit ? `, CUIT ${legal.cuit}` : ""}
          </span>
          <div className="footer__legal-links">
            <Link href="/arrepentimiento" className="withdraw-link">
              Botón de arrepentimiento
            </Link>
            <a
              href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
              target="_blank"
              rel="noopener noreferrer"
            >
              Defensa de las y los consumidores
            </a>
            {legal.data_fiscal_url && (
              <a href={legal.data_fiscal_url} target="_blank" rel="noopener noreferrer">
                Data fiscal
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

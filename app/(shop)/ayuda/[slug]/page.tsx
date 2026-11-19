import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/format";
import type { Settings } from "@/lib/types";

export const revalidate = 300;

const PAGES = ["envios", "cambios", "talles", "terminos", "privacidad"] as const;
type Slug = (typeof PAGES)[number];
const TITLES: Record<Slug, string> = {
  envios: "Envíos y pagos",
  cambios: "Cambios y devoluciones",
  talles: "Guía de talles",
  terminos: "Términos y condiciones",
  privacidad: "Política de privacidad",
};

export function generateStaticParams() {
  return PAGES.map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: TITLES[slug as Slug] ?? "Ayuda" };
}

function Envios({ s }: { s: Settings }) {
  const t = s.payments.transfer;
  return (
    <>
      <h2>Envíos</h2>
      <p>
        Enviamos a todo el país. En el checkout ponés tu provincia y código postal y te mostramos el precio exacto según
        lo que pesa tu compra. {s.shipping.eta}
      </p>
      <ul>
        {s.shipping.zones
          .filter((z) => z.enabled)
          .map((z) => {
            const prices = [...z.tiers.map((t) => t.price), z.price];
            const from = Math.min(...prices);
            return (
              <li key={z.id}>
                <b>{z.label}</b>
                {z.provinces.length ? ` (${z.provinces.join(", ")})` : ""}: {prices.length > 1 ? "desde " : ""}
                {money(from)}. {z.detail}
                {z.detail && !z.detail.endsWith(".") ? "." : ""}
              </li>
            );
          })}
      </ul>
      {s.shipping.free_from ? <p>El envío es gratis en compras desde {money(s.shipping.free_from)}.</p> : null}
      {s.shipping.pickup.enabled && (
        <p>
          También podés retirar sin cargo en {s.shipping.pickup.address}. {s.shipping.pickup.hours}.
        </p>
      )}
      <h2>Pagos</h2>
      <ul>
        {s.payments.mercadopago.enabled && <li>Mercado Pago: tarjetas de crédito, débito y dinero en cuenta.</li>}
        {t.enabled && (
          <li>
            Transferencia bancaria{t.discount_pct ? ` con ${t.discount_pct}% de descuento sobre los productos` : ""}. Te
            guardamos el pedido 48 horas hasta recibir el comprobante.
          </li>
        )}
        {s.payments.cash.enabled && <li>Efectivo, sólo al retirar.</li>}
      </ul>
      <p>Los pedidos pagados con Mercado Pago se reservan durante 45 minutos mientras completás el pago.</p>
    </>
  );
}

function Cambios({ s }: { s: Settings }) {
  return (
    <>
      <h2>Cambios de talle, color o producto</h2>
      <p>
        Tenés 30 días corridos desde que recibís tu pedido para pedir un cambio. La prenda tiene que estar sin uso, sin
        lavar y con sus etiquetas. Por higiene, la ropa interior y los bodys se cambian sólo con el protector adhesivo
        intacto.
      </p>
      <p>
        Escribinos {s.contact.whatsapp ? "por WhatsApp" : "por mensaje"} con tu número de pedido y coordinamos el cambio.
      </p>
      <h2>Derecho de arrepentimiento</h2>
      <p>
        Como toda compra a distancia, podés arrepentirte dentro de los 10 días corridos desde que recibiste el producto,
        sin dar explicaciones (artículo 34 de la Ley 24.240). El producto tiene que volver en el mismo estado en que lo
        recibiste y nosotros te devolvemos el total pagado.
      </p>
      <p>
        Para hacerlo, usá el <Link href="/arrepentimiento">botón de arrepentimiento</Link>. Te damos un código de
        trámite en el momento.
      </p>
      <h2>Productos con falla</h2>
      <p>Si algo llegó con una falla, escribinos dentro de los 30 días y lo cambiamos sin costo.</p>
    </>
  );
}

function Talles({ s }: { s: Settings }) {
  return (
    <>
      <p>
        Medidas del cuerpo en centímetros. Si quedás entre dos talles, elegí el más grande. En los jeans el talle es el
        número de cintura. Si tenés dudas, escribinos y te pasamos las medidas de la prenda.
      </p>
      <div style={{ overflowX: "auto", marginTop: 24 }}>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Talle</th>
              <th scope="col">Busto</th>
              <th scope="col">Cintura</th>
              <th scope="col">Cadera</th>
            </tr>
          </thead>
          <tbody>
            {s.size_guide.map((r) => (
              <tr key={r.size}>
                <th scope="row">{r.size}</th>
                <td>{r.busto}</td>
                <td>{r.cintura}</td>
                <td>{r.cadera}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Cómo medirte</h2>
      <ul>
        <li>Busto: alrededor de la parte más llena, con la cinta horizontal.</li>
        <li>Cintura: en la parte más angosta del torso.</li>
        <li>Cadera: en la parte más ancha, con los pies juntos.</li>
      </ul>
    </>
  );
}

function Terminos({ s }: { s: Settings }) {
  const name = s.legal.business_name || "Beibi Doll";
  return (
    <>
      <p>
        Este sitio es operado por {name}
        {s.legal.cuit ? `, CUIT ${s.legal.cuit}` : ""}. Al comprar aceptás estas condiciones, que se rigen por las leyes
        de la República Argentina, en especial la Ley 24.240 de Defensa del Consumidor.
      </p>
      <h2>Precios y stock</h2>
      <p>
        Los precios están en pesos argentinos e incluyen impuestos. El precio válido es el que figura al confirmar el pedido.
        El stock se reserva al crear el pedido y se libera si el pago no se completa en el plazo indicado.
      </p>
      <h2>Pedidos</h2>
      <p>
        Te confirmamos cada pedido en la página de seguimiento. Podemos cancelar un pedido si detectamos un error
        evidente de precio o stock; en ese caso devolvemos el total pagado.
      </p>
      <h2>Entregas</h2>
      <p>
        Los plazos de entrega son estimados y corren desde que se acredita el pago. Revisá que la dirección esté
        completa: un envío devuelto por datos incorrectos se reenvía con costo.
      </p>
      <h2>Cambios y arrepentimiento</h2>
      <p>
        Ver la <Link href="/ayuda/cambios">política de cambios y devoluciones</Link>.
      </p>
      <h2>Reclamos</h2>
      <p>
        Podés escribirnos por los canales de contacto o iniciar un reclamo ante{" "}
        <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">
          Defensa de las y los Consumidores
        </a>
        .
      </p>
    </>
  );
}

function Privacidad({ s }: { s: Settings }) {
  const name = s.legal.business_name || "Beibi Doll";
  return (
    <>
      <p>
        {name} es responsable de los datos que nos das al comprar: nombre, email, teléfono, DNI y dirección. Los usamos
        sólo para procesar tu pedido, enviarlo y responder tus consultas. No los vendemos ni los compartimos, salvo con
        el correo que lo entrega y con Mercado Pago cuando elegís ese medio.
      </p>
      <p>
        Tus datos se guardan en servidores con acceso restringido. No guardamos datos de tarjetas: el pago lo procesa
        Mercado Pago en su propio sitio.
      </p>
      <h2>Tus derechos</h2>
      <p>
        Podés pedir acceso, corrección o eliminación de tus datos escribiéndonos{s.contact.email ? ` a ${s.contact.email}` : ""}.
        Según la Ley 25.326, la Agencia de Acceso a la Información Pública es el órgano de control y atiende denuncias
        sobre incumplimientos.
      </p>
      <h2>Cuenta y novedades</h2>
      <p>
        Si creás una cuenta guardamos tu nombre, email y teléfono para mostrarte tus pedidos y completar tus datos al
        comprar. Sólo te mandamos novedades y promociones si lo aceptás expresamente, y cada mail trae un enlace para
        darte de baja al instante. Podés pedir que borremos tu cuenta escribiéndonos.
      </p>
      <h2>Almacenamiento en tu navegador</h2>
      <p>Guardamos tu bolsa de compras en tu propio navegador para que no se pierda, y una cookie de sesión si ingresás a tu cuenta. No usamos cookies publicitarias.</p>
    </>
  );
}

export default async function HelpPage({ params }: Props) {
  const { slug } = await params;
  if (!PAGES.includes(slug as Slug)) notFound();
  const s = await getSettings();
  const Body = { envios: Envios, cambios: Cambios, talles: Talles, terminos: Terminos, privacidad: Privacidad }[slug as Slug];
  return (
    <div className="wrap">
      <article className="prose">
        <h1>{TITLES[slug as Slug]}</h1>
        <Body s={s} />
      </article>
    </div>
  );
}

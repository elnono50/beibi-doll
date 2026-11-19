import { SITE_URL } from "../config";
import { dateTime, money, PAYMENT_LABEL } from "../format";
import type { Order, OrderItem, Settings } from "../types";

/* ---------------------------------------------------------------------
   Mails de Beibi Doll: tablas y estilos en línea para que se vean igual en
   Gmail, Outlook, Apple Mail y celulares. Marco negro con el logo, cuerpo
   claro (se lee bien también en modo oscuro) y acentos bordó. Tipografías
   de la tienda con alternativas de sistema, porque los clientes de mail no
   cargan fuentes propias de forma confiable.
   --------------------------------------------------------------------- */

const C = {
  bg: "#0d0c0e",
  card: "#f6f4f2",
  sand: "#ece8e5",
  ink: "#141215",
  soft: "#3d383f",
  mute: "#6e6870",
  line: "#ddd7d3",
  gold: "#8e1230", // acento bordó
  goldInk: "#8e1230",
  footer: "#a39ea6",
};
const SERIF = `Anton,'Arial Narrow','Helvetica Neue',Impact,Arial,sans-serif`;
const SANS = `Inter,'Helvetica Neue',Helvetica,Arial,sans-serif`;
const CAPS = "text-transform:uppercase;letter-spacing:.01em;";

export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeUrl = (u: string) => (/^https:\/\//.test(u) ? u : SITE_URL);

export function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px"><tr><td style="background:${C.gold};border-radius:4px">
<a href="${esc(safeUrl(href))}" style="display:inline-block;padding:16px 30px;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(label)}</a>
</td></tr></table>`;
}

export function paragraph(text: string) {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.soft}">${esc(text)}</p>`;
}

/** Recuadro gris con borde bordó (datos para transferir, retiro, etc.). */
export function note(html: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr>
<td style="background:${C.sand};border-left:2px solid ${C.gold};padding:18px 20px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.soft}">${html}</td></tr></table>`;
}

function keyValues(rows: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows
    .map(
      ([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-family:${SANS};font-size:14px;color:${C.mute};white-space:nowrap;vertical-align:top">${esc(k)}</td>
<td style="padding:4px 0;font-family:${SANS};font-size:15px;color:${C.ink};font-weight:600;word-break:break-all">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

function itemsTable(order: Order & { items: OrderItem[] }) {
  const row = (left: string, right: string, opts: { strong?: boolean; top?: boolean } = {}) =>
    `<tr><td style="padding:${opts.top ? "14px" : "6px"} 0 6px;${opts.top ? `border-top:1px solid ${C.line};` : ""}font-family:${SANS};font-size:${opts.strong ? "17px" : "15px"};color:${opts.strong ? C.ink : C.soft};${opts.strong ? "font-weight:600;" : ""}">${left}</td>
<td align="right" style="padding:${opts.top ? "14px" : "6px"} 0 6px;${opts.top ? `border-top:1px solid ${C.line};` : ""}font-family:${SANS};font-size:${opts.strong ? "17px" : "15px"};color:${C.ink};${opts.strong ? "font-weight:600;" : ""}white-space:nowrap">${right}</td></tr>`;
  const items = order.items
    .map(
      (it) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.line}">
<div style="font-family:${SANS};font-size:16px;font-weight:600;color:${C.ink};line-height:1.3">${esc(it.product_name)}</div>
<div style="font-family:${SANS};font-size:13px;color:${C.mute};margin-top:3px">${esc(it.variant_label)}${it.quantity > 1 ? `, ${it.quantity} unidades` : ""}</div></td>
<td align="right" style="padding:12px 0;border-bottom:1px solid ${C.line};font-family:${SANS};font-size:15px;color:${C.ink};white-space:nowrap;vertical-align:top">${money(it.unit_price * it.quantity)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px">${items}
${row("Subtotal", money(order.subtotal))}
${order.discount > 0 ? row("Descuento", `−${money(order.discount)}`) : ""}
${row(order.shipping_method === "pickup" ? "Retiro en el local" : `Envío: ${esc(order.shipping_zone_label ?? "")}`, order.shipping_cost ? money(order.shipping_cost) : "Gratis")}
${row("Total", money(order.total), { strong: true, top: true })}
</table>`;
}

type LayoutOpts = {
  preheader: string;
  kicker?: string;
  title: string;
  body: string;
  settings: Settings;
  footerNote: string;
  unsubscribeUrl?: string;
};

export function layout(o: LayoutOpts) {
  const { contact } = o.settings;
  const links = [
    contact.instagram && `<a href="https://instagram.com/${esc(contact.instagram)}" style="color:#ffffff;text-decoration:underline">Instagram</a>`,
    contact.whatsapp && `<a href="https://wa.me/${esc(contact.whatsapp)}" style="color:#ffffff;text-decoration:underline">WhatsApp</a>`,
    `<a href="${SITE_URL}" style="color:#ffffff;text-decoration:underline">${esc(SITE_URL.replace(/^https?:\/\//, ""))}</a>`,
  ]
    .filter(Boolean)
    .join(`<span style="color:${C.gold}">&nbsp;&nbsp;&nbsp;</span>`);

  return `<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@media (max-width:620px){.card{padding:32px 22px !important}.title{font-size:30px !important}.pcell{display:block !important;width:100% !important;padding:0 0 24px !important}}
a{color:${C.ink}}
</style></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td><a href="${SITE_URL}"><img src="${SITE_URL}/email/header.jpg" width="600" alt="Beibi Doll" style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:Georgia,serif;font-style:italic;font-size:40px;color:#ffffff;background:${C.bg}"></a></td></tr>
<tr><td class="card" style="background:${C.card};padding:44px 44px 36px">
${o.kicker ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${C.goldInk}">${esc(o.kicker)}</p>` : ""}
<h1 class="title" style="margin:0 0 20px;font-family:${SERIF};font-weight:400;font-size:38px;line-height:1.05;color:${C.ink};${CAPS}">${esc(o.title)}</h1>
${o.body}
</td></tr>
<tr><td style="padding:28px 24px 0;text-align:center;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.footer}">
<div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;color:#ffffff;margin-bottom:10px">Beibi.doll</div>
<div>${links}</div>
<div style="margin-top:14px">${esc(o.footerNote)}</div>
${o.unsubscribeUrl ? `<div style="margin-top:8px"><a href="${esc(o.unsubscribeUrl)}" style="color:${C.footer};text-decoration:underline">Darme de baja de las novedades</a></div>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

const toText = (lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join("\n");

export const orderUrl = (o: Order) => `${SITE_URL}/pedido/${o.id}?t=${o.access_token}`;

type FullOrder = Order & { items: OrderItem[] };
const ORDER_NOTE = "Recibís este mail porque hiciste un pedido en Beibi Doll.";

/* ---------------------------- Clientas ----------------------------- */

export function orderReceived(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const t = s.payments.transfer;
  let next = "";
  if (o.payment_method === "transfer") {
    const rows: [string, string][] = [];
    if (t.alias) rows.push(["Alias", t.alias]);
    if (t.cbu) rows.push(["CBU / CVU", t.cbu]);
    if (t.holder) rows.push(["Titular", t.holder]);
    if (t.bank) rows.push(["Banco", t.bank]);
    rows.push(["Importe", money(o.total)]);
    next =
      note(
        `<div style="font-family:${SERIF};font-size:20px;color:${C.ink};margin-bottom:10px;${CAPS}">Datos para transferir</div>${keyValues(rows)}
${o.reserved_until ? `<div style="margin-top:12px;font-size:14px">Te guardamos las prendas hasta el ${esc(dateTime(o.reserved_until))}.</div>` : ""}`,
      ) + paragraph("Cuando transfieras, mandanos el comprobante por WhatsApp o respondiendo este mail.");
  } else if (o.payment_method === "cash") {
    next = note(
      `<div style="font-family:${SERIF};font-size:20px;color:${C.ink};margin-bottom:8px;${CAPS}">Retiro y pago en efectivo</div>${esc(s.shipping.pickup.address)}${s.shipping.pickup.hours ? `<br>${esc(s.shipping.pickup.hours)}` : ""}<br>Te avisamos por mail cuando esté listo para retirar.`,
    );
  }
  const html = layout({
    preheader:
      o.payment_method === "transfer"
        ? `Transferí ${money(o.total)} y te guardamos las prendas.`
        : `Recibimos tu pedido #${o.number}.`,
    kicker: `Pedido #${o.number}`,
    title: o.payment_method === "transfer" ? `¡Ya casi es tuyo, ${first}!` : `Gracias, ${first}`,
    body:
      paragraph(
        o.payment_method === "transfer"
          ? "Recibimos tu pedido. Para confirmarlo, transferí el total con los datos de abajo."
          : "Recibimos tu pedido. Te avisamos por mail cuando esté listo para retirar.",
      ) +
      next +
      itemsTable(o) +
      button("Ver mi pedido", orderUrl(o)),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  const text = toText([
    `Hola ${first},`,
    `Recibimos tu pedido #${o.number} por ${money(o.total)}.`,
    o.payment_method === "transfer" && `Transferí a: ${[t.alias && `alias ${t.alias}`, t.cbu && `CBU ${t.cbu}`].filter(Boolean).join(", ")}`,
    `Seguí tu pedido: ${orderUrl(o)}`,
  ]);
  return { subject: `Recibimos tu pedido #${o.number}`, html, text };
}

export function orderPaid(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const html = layout({
    preheader: `Confirmamos el pago de tu pedido #${o.number}.`,
    kicker: `Pedido #${o.number}`,
    title: "Pago confirmado",
    body:
      paragraph(
        `${first}, ya recibimos tu pago. ${
          o.shipping_method === "pickup"
            ? "Te avisamos por mail cuando esté listo para retirar."
            : s.shipping.eta || "Te avisamos cuando despachemos el pedido."
        }`,
      ) +
      itemsTable(o) +
      button("Ver mi pedido", orderUrl(o)),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  return {
    subject: `Pago confirmado, pedido #${o.number}`,
    html,
    text: toText([`Hola ${first},`, `Confirmamos el pago de tu pedido #${o.number}.`, orderUrl(o)]),
  };
}

export function orderShipped(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const html = layout({
    preheader: `Tu pedido #${o.number} ya está en camino.`,
    kicker: `Pedido #${o.number}`,
    title: "Tu pedido está en camino",
    body:
      paragraph(
        `${first}, ya despachamos tu pedido${o.shipping_zone_label ? ` por ${o.shipping_zone_label}` : ""}.${
          o.shipping_eta ? ` ${o.shipping_eta}.` : ""
        }`,
      ) +
      (o.tracking_code
        ? note(`<div style="font-size:14px;color:${C.mute}">Código de seguimiento</div><div style="font-family:${SERIF};font-size:24px;color:${C.ink};margin-top:4px;word-break:break-all;letter-spacing:.02em">${esc(o.tracking_code)}</div>`)
        : "") +
      (o.shipping_branch ? paragraph(`Lo retirás en: ${o.shipping_branch}. Llevá tu DNI.`) : "") +
      button("Ver mi pedido", orderUrl(o)),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  return {
    subject: `Tu pedido #${o.number} está en camino`,
    html,
    text: toText([`Hola ${first},`, `Despachamos tu pedido #${o.number}.`, o.tracking_code && `Seguimiento: ${o.tracking_code}`, orderUrl(o)]),
  };
}

export function orderReady(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const pk = s.shipping.pickup;
  const html = layout({
    preheader: `Tu pedido #${o.number} ya está listo para retirar.`,
    kicker: `Pedido #${o.number}`,
    title: "Listo para retirar",
    body:
      paragraph(`${first}, tu pedido ya está separado y esperándote.`) +
      note(
        `<div style="font-family:${SERIF};font-size:20px;color:${C.ink};margin-bottom:8px;${CAPS}">Dónde y cuándo</div>${esc(pk.address)}${
          pk.hours ? `<br>${esc(pk.hours)}` : ""
        }${o.payment_method === "cash" ? `<br><br>Pagás <b>${money(o.total)}</b> en efectivo al retirar.` : ""}`,
      ) +
      paragraph(`Decí tu nombre o el número de pedido #${o.number}. Si viene otra persona a buscarlo, avisanos respondiendo este mail.`) +
      button("Ver mi pedido", orderUrl(o)),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  return {
    subject: `Tu pedido #${o.number} está listo para retirar`,
    html,
    text: toText([`Hola ${first},`, `Tu pedido #${o.number} está listo para retirar.`, pk.address, pk.hours, orderUrl(o)]),
  };
}

export function orderDelivered(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const ig = s.contact.instagram;
  const html = layout({
    preheader: "Gracias por elegirnos.",
    kicker: `Pedido #${o.number}`,
    title: `¡Que lo disfrutes, ${first}!`,
    body:
      paragraph(
        o.shipping_method === "pickup"
          ? "Gracias por pasar a buscar tu pedido."
          : "Tu pedido figura como entregado. Esperamos que te encante.",
      ) +
      paragraph(
        `Si algo no te queda como esperabas, tenés 30 días para cambiarlo.${ig ? ` Y si lo estrenás, etiquetanos en Instagram: @${ig}` : ""}`,
      ) +
      button("Ver lo nuevo", `${SITE_URL}/tienda?orden=nuevos`),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  return {
    subject: `¡Gracias por tu compra, ${first}!`,
    html,
    text: toText([`Hola ${first},`, "Gracias por tu compra.", `${SITE_URL}/tienda`]),
  };
}

export function orderCancelled(o: FullOrder, s: Settings) {
  const first = o.customer_name.split(" ")[0];
  const html = layout({
    preheader: `Cancelamos tu pedido #${o.number}.`,
    kicker: `Pedido #${o.number}`,
    title: "Pedido cancelado",
    body:
      paragraph(
        `${first}, tu pedido fue cancelado y las prendas volvieron a la tienda. Si ya habías pagado, te devolvemos el total por el mismo medio.`,
      ) + paragraph("Si creés que es un error, respondé este mail y lo resolvemos."),
    settings: s,
    footerNote: ORDER_NOTE,
  });
  return {
    subject: `Pedido #${o.number} cancelado`,
    html,
    text: toText([`Hola ${first},`, `Cancelamos tu pedido #${o.number}.`]),
  };
}

export function withdrawalReceived(r: { name: string; order_number: string; code: string }, s: Settings) {
  const html = layout({
    preheader: `Código de trámite ${r.code}.`,
    kicker: "Botón de arrepentimiento",
    title: "Recibimos tu solicitud",
    body:
      paragraph(`${r.name.split(" ")[0]}, registramos tu arrepentimiento del pedido #${r.order_number}.`) +
      note(`<div style="font-size:14px;color:${C.mute}">Código de trámite</div><div style="font-family:${SERIF};font-size:26px;color:${C.ink};margin-top:4px;letter-spacing:.04em">${esc(r.code)}</div>`) +
      paragraph("Te escribimos dentro de las 24 h hábiles para coordinar la devolución."),
    settings: s,
    footerNote: "Recibís este mail porque usaste el botón de arrepentimiento en Beibi Doll.",
  });
  return {
    subject: `Solicitud de arrepentimiento ${r.code}`,
    html,
    text: toText([`Registramos tu arrepentimiento del pedido #${r.order_number}.`, `Código: ${r.code}`]),
  };
}

/* ------------------------- Avisos a la tienda ------------------------- */

export function adminNewOrder(o: FullOrder, s: Settings, reason: "created" | "paid") {
  const a = o.address;
  const html = layout({
    preheader: `${o.customer_name}, ${money(o.total)}`,
    kicker: `Pedido #${o.number}`,
    title: reason === "paid" ? "Entró un pedido pagado" : "Entró un pedido nuevo",
    body:
      paragraph(
        reason === "paid"
          ? "Mercado Pago confirmó el pago. Ya podés prepararlo."
          : o.payment_method === "transfer"
            ? "Espera la transferencia. Cuando te llegue el comprobante, confirmalo en el panel."
            : "Paga en efectivo al retirar. Cuando lo tengas listo, marcalo como “Listo para retirar” y le llega un mail.",
      ) +
      note(
        keyValues([
          ["Clienta", o.customer_name],
          ["Teléfono", o.phone],
          ["Email", o.email],
          ["Pago", PAYMENT_LABEL[o.payment_method]],
          [
            "Entrega",
            o.shipping_method === "pickup"
              ? "Retiro en el local"
              : a
                ? `${o.shipping_zone_label ?? ""}: ${a.street} ${a.number}${a.floor ? ` ${a.floor}` : ""}, ${a.city}, ${a.province} (${a.zip})`
                : "-",
          ],
          ...(o.shipping_branch ? ([["Sucursal", o.shipping_branch]] as [string, string][]) : []),
        ]),
      ) +
      itemsTable(o) +
      button("Abrir en el panel", `${SITE_URL}/admin/pedidos/${o.id}`),
    settings: s,
    footerNote: "Aviso automático del panel de Beibi Doll.",
  });
  return {
    subject: `${reason === "paid" ? "Pagado" : "Nuevo pedido"} #${o.number}: ${o.customer_name}, ${money(o.total)}`,
    html,
    text: toText([`Pedido #${o.number}`, o.customer_name, money(o.total), `${SITE_URL}/admin/pedidos/${o.id}`]),
  };
}

export function adminWithdrawal(r: { name: string; email: string; order_number: string; code: string }, s: Settings) {
  const html = layout({
    preheader: `Pedido #${r.order_number}`,
    kicker: "Botón de arrepentimiento",
    title: "Nueva solicitud de arrepentimiento",
    body:
      paragraph("La ley da 10 días corridos desde la entrega. Respondé dentro de las 24 h hábiles.") +
      note(keyValues([["Clienta", r.name], ["Email", r.email], ["Pedido", `#${r.order_number}`], ["Código", r.code]])) +
      button("Ver en el panel", `${SITE_URL}/admin/arrepentimientos`),
    settings: s,
    footerNote: "Aviso automático del panel de Beibi Doll.",
  });
  return { subject: `Arrepentimiento del pedido #${r.order_number}`, html, text: `Arrepentimiento ${r.code}, pedido #${r.order_number}` };
}

/* ---------------------------- Novedades ---------------------------- */

export type EmailProduct = {
  name: string;
  price: number;
  compare_at_price: number | null;
  image: string | null;
  url: string;
  note: string; // color, o talles que volvieron
};

/** Tarjetas de producto de a dos (en celular se apilan). */
export function productGrid(items: EmailProduct[]) {
  if (!items.length) return "";
  const card = (p: EmailProduct, side: "l" | "r") => `<td class="pcell" width="50%" valign="top" style="padding:${side === "l" ? "0 8px 20px 0" : "0 0 20px 8px"}">
<a href="${esc(safeUrl(p.url))}" style="text-decoration:none;color:${C.ink}">
${p.image ? `<img src="${esc(p.image)}" width="244" alt="${esc(p.name)}" style="display:block;width:100%;height:auto;border:0;background:#d9d6d4">` : ""}
<div style="font-family:${SERIF};font-size:20px;line-height:1.15;color:${C.ink};margin-top:12px;${CAPS}">${esc(p.name)}</div>
${p.note ? `<div style="font-family:${SANS};font-size:13px;color:${C.mute};margin-top:3px">${esc(p.note)}</div>` : ""}
<div style="font-family:${SANS};font-size:15px;color:${C.ink};margin-top:6px">${money(p.price)}${
    p.compare_at_price && p.compare_at_price > p.price
      ? ` <span style="color:${C.mute};text-decoration:line-through;font-size:13px">${money(p.compare_at_price)}</span>`
      : ""
  }</div>
<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.goldInk};margin-top:8px;text-decoration:underline">Ver producto</div>
</a></td>`;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(`<tr>${card(items[i], "l")}${items[i + 1] ? card(items[i + 1], "r") : `<td class="pcell" width="50%"></td>`}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0">${rows.join("")}</table>`;
}

export type CampaignKind = "libre" | "nuevos" | "stock";

export type Campaign = {
  kind?: CampaignKind;
  subject: string;
  preheader: string;
  title: string;
  text: string;
  image: string;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  products?: EmailProduct[];
};

function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.soft}">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function newsletter(c: Campaign, s: Settings, unsubscribeUrl: string) {
  const img = c.image
    ? `<img src="${esc(c.image)}" width="512" alt="${esc(c.image_alt)}" style="display:block;width:100%;height:auto;border:0;margin:0 0 28px">`
    : "";
  const kicker = c.kind === "nuevos" ? "Novedades de la tienda" : c.kind === "stock" ? "Reposición" : undefined;
  const html = layout({
    preheader: c.preheader || c.title,
    kicker,
    title: c.title,
    body:
      img +
      paragraphs(c.text) +
      productGrid(c.products ?? []) +
      (c.cta_label && c.cta_url ? button(c.cta_label, c.cta_url) : ""),
    settings: s,
    footerNote: "Recibís este mail porque te suscribiste a las novedades de Beibi Doll.",
    unsubscribeUrl,
  });
  return {
    subject: c.subject,
    html,
    text: toText([
      c.title,
      c.text,
      ...(c.products ?? []).map((p) => `${p.name}${p.note ? ` (${p.note})` : ""}: ${money(p.price)}, ${p.url}`),
      c.cta_url && `${c.cta_label}: ${c.cta_url}`,
      `Darte de baja: ${unsubscribeUrl}`,
    ]),
  };
}

/** Aviso único: volvió el color y talle que pidió (`size` = "Negro · Talle M"). */
export function stockBack(p: EmailProduct & { size: string }, s: Settings) {
  const html = layout({
    preheader: `${p.name} (${p.size}) volvió a estar disponible.`,
    kicker: "Volvió lo que esperabas",
    title: `${p.name} ya está de nuevo`,
    body:
      paragraphs(`Repusimos ${p.name} en ${p.size} y te avisamos apenas entró. Vuela rápido: si lo querés, no esperes.`) +
      productGrid([{ ...p, note: p.size }]) +
      button("Comprarlo ahora", p.url),
    settings: s,
    footerNote: "Recibís este único mail porque pediste que te avisemos cuando vuelva.",
  });
  return {
    subject: `Volvió: ${p.name}, ${p.size}`,
    html,
    text: toText([`${p.name} (${p.size}) volvió a estar disponible.`, p.url]),
  };
}

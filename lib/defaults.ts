import type { Settings } from "./types";

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1800&q=80`;

export const unsplash = u;

/** Valores iniciales. Todo es editable desde el panel. */
export const DEFAULT_SETTINGS: Settings = {
  hero: [
    {
      id: "h1",
      image: u("1786206089358-ce233fc9d37b"),
      image_alt: "Chica con vestido negro y anteojos de sol bajando de un auto de noche",
      title: "Salí como quieras",
      text: "Encaje, denim gastado, animal print y mucho negro. Prendas para que te miren dos veces.",
      cta_label: "Ver lo nuevo",
      cta_href: "/tienda?orden=nuevos",
    },
    {
      id: "h2",
      image: u("1790069484700-2dde2cf6c854"),
      image_alt: "Chica con corset negro y jean apoyada contra una pared de piedra",
      title: "Corsets & tops",
      text: "Los que más nos piden, en todos los talles mientras duren.",
      cta_label: "Ver tops",
      cta_href: "/tienda?categoria=tops",
    },
    {
      id: "h3",
      image: u("1762164130276-021d7c91cd89"),
      image_alt: "Chica con campera de cuero y jean holgado",
      title: "Denim 2000",
      text: "Tiro bajo, holgados y gastados. El jean que combina con todo lo demás.",
      cta_label: "Ver jeans",
      cta_href: "/tienda?categoria=jeans",
    },
  ],
  announcements: [
    "Envíos a todo el país",
    "Retiro gratis en nuestro local de San Juan",
    "Pagá con Mercado Pago, transferencia o efectivo",
  ],
  editorial: {
    image: u("1576193929684-06c6c6a8b582"),
    image_alt: "Chica con campera de cuero negra y gorro",
    title: "Nada de ropa aburrida",
    text: "Elegimos cada prenda una por una: lo que se usa ahora, en cantidades chicas para que no te cruces a nadie igual. Si algo se agota, avisanos y te escribimos cuando vuelva.",
  },
  shipping: {
    zones: [
      {
        id: "moto-san-juan",
        label: "Moto en Gran San Juan",
        detail: "Te lo llevamos en 24 a 48 h hábiles",
        price: 3500,
        enabled: true,
        provinces: ["San Juan"],
        tiers: [],
        branch: false,
      },
      {
        id: "via-cargo-domicilio",
        label: "Vía Cargo a domicilio",
        detail: "De 3 a 6 días hábiles",
        price: 14900,
        enabled: true,
        provinces: [],
        tiers: [
          { max_g: 1000, price: 9900 },
          { max_g: 3000, price: 11900 },
        ],
        branch: false,
      },
      {
        id: "via-cargo-sucursal",
        label: "Vía Cargo a sucursal",
        detail: "Retirás en la sucursal que elijas, de 3 a 6 días hábiles",
        price: 11900,
        enabled: true,
        provinces: [],
        tiers: [
          { max_g: 1000, price: 7500 },
          { max_g: 3000, price: 8900 },
        ],
        branch: true,
      },
    ],
    free_from: null,
    eta: "Despachamos dentro de las 48 h hábiles de acreditado el pago.",
    pickup: {
      enabled: true,
      address: "Nuestro local en San Juan (te pasamos la dirección al confirmar)",
      hours: "Lunes a sábados",
    },
    carrier: {
      enabled: false,
      origin_zip: "5400",
      home: true,
      branch: true,
      package: { length: 30, width: 25, height: 8 },
      extra: 0,
    },
  },
  payments: {
    mercadopago: { enabled: true },
    transfer: {
      enabled: true,
      discount_pct: 0,
      holder: "",
      bank: "",
      cbu: "",
      alias: "",
      cuit: "",
    },
    cash: { enabled: true },
  },
  contact: { whatsapp: "", instagram: "beibi.doll_", email: "", city: "San Juan" },
  legal: { business_name: "", cuit: "", data_fiscal_url: "" },
  size_guide: [
    { size: "S", busto: "82 a 86", cintura: "62 a 66", cadera: "88 a 92" },
    { size: "M", busto: "86 a 90", cintura: "66 a 70", cadera: "92 a 96" },
    { size: "L", busto: "90 a 96", cintura: "70 a 76", cadera: "96 a 102" },
    { size: "XL", busto: "96 a 102", cintura: "76 a 82", cadera: "102 a 108" },
  ],
  tagline: "La vida es muy corta para llevar ropa aburrida",
};

/** Combina lo guardado con los valores por defecto (sin perder claves nuevas). */
export function mergeSettings(saved: unknown): Settings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  return {
    hero: Array.isArray(s.hero) && s.hero.length ? s.hero : d.hero,
    announcements: Array.isArray(s.announcements) ? s.announcements : d.announcements,
    editorial: { ...d.editorial, ...(s.editorial ?? {}) },
    shipping: {
      ...d.shipping,
      ...(s.shipping ?? {}),
      zones: (Array.isArray(s.shipping?.zones) ? s.shipping!.zones : d.shipping.zones).map((z) => ({
        ...z,
        provinces: Array.isArray(z.provinces) ? z.provinces : [],
        tiers: Array.isArray(z.tiers) ? z.tiers : [],
        branch: Boolean(z.branch),
      })),
      pickup: { ...d.shipping.pickup, ...(s.shipping?.pickup ?? {}) },
      carrier: {
        ...d.shipping.carrier,
        ...(s.shipping?.carrier ?? {}),
        package: { ...d.shipping.carrier.package, ...(s.shipping?.carrier?.package ?? {}) },
      },
    },
    payments: {
      mercadopago: { ...d.payments.mercadopago, ...(s.payments?.mercadopago ?? {}) },
      transfer: { ...d.payments.transfer, ...(s.payments?.transfer ?? {}) },
      cash: { ...d.payments.cash, ...(s.payments?.cash ?? {}) },
    },
    contact: { ...d.contact, ...(s.contact ?? {}) },
    legal: { ...d.legal, ...(s.legal ?? {}) },
    size_guide: Array.isArray(s.size_guide) && s.size_guide.length ? s.size_guide : d.size_guide,
    tagline: typeof s.tagline === "string" ? s.tagline : d.tagline,
  };
}

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export const money = (n: number) => ars.format(Math.round(n));

const dt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Argentina/Buenos_Aires",
});
/** "17 oct 2026, 14:05 h" */
export const dateTime = (iso: string) => `${dt.format(new Date(iso)).replace(/\./g, "")} h`;

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const STATUS_LABEL: Record<string, string> = {
  pending: "Esperando pago",
  paid: "Pagado",
  preparing: "En preparación",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido",
};

/** Con retiro en el local, "en preparación" significa que ya está listo para retirar. */
export const statusLabel = (status: string, method?: string | null) =>
  method === "pickup" && status === "preparing"
    ? "Listo para retirar"
    : method === "pickup" && status === "delivered"
      ? "Retirado"
      : (STATUS_LABEL[status] ?? status);

export const PAYMENT_LABEL: Record<string, string> = {
  mercadopago: "Mercado Pago",
  transfer: "Transferencia",
  cash: "Efectivo al retirar",
};

export const PROVINCES = [
  "Ciudad Autónoma de Buenos Aires",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

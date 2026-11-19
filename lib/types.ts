export type ProductColor = { name: string; hex: string };

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  sort: number;
  active: boolean;
};

export type ProductImage = {
  id: string;
  url: string;
  path?: string | null;
  alt: string;
  color?: string | null;
  sort: number;
};

export type Variant = {
  id: string;
  color: string;
  size: string;
  stock: number;
  sort: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category_id: string | null;
  price: number;
  compare_at_price: number | null;
  colors: ProductColor[];
  weight_g: number;
  description: string;
  details: string;
  care: string;
  featured: boolean;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at?: string;
  images: ProductImage[];
  variants: Variant[];
  category?: Pick<Category, "slug" | "name"> | null;
};

export type HeroSlide = {
  id: string;
  image: string;
  image_alt: string;
  title: string;
  text: string;
  cta_label: string;
  cta_href: string;
};

/**
 * Tarifa de envío (por ejemplo, la tabla de Vía Cargo).
 * Se aplica a las provincias listadas; si no lista ninguna, vale para el resto del país.
 * El precio sale del primer escalón de peso que alcanza; si pesa más, se usa `price`.
 */
export type ShippingZone = {
  id: string;
  label: string;
  detail: string;
  price: number;
  enabled: boolean;
  provinces: string[];
  tiers: { max_g: number; price: number }[];
  branch: boolean;
};

export type Settings = {
  hero: HeroSlide[];
  announcements: string[];
  editorial: { image: string; image_alt: string; title: string; text: string };
  shipping: {
    zones: ShippingZone[];
    free_from: number | null;
    /** Cotización automática con Correo Argentino (MiCorreo). Credenciales en variables de entorno. */
    carrier: {
      enabled: boolean;
      origin_zip: string;
      home: boolean;
      branch: boolean;
      package: { length: number; width: number; height: number };
      extra: number;
    };
    eta: string;
    pickup: { enabled: boolean; address: string; hours: string };
  };
  payments: {
    mercadopago: { enabled: boolean };
    transfer: {
      enabled: boolean;
      discount_pct: number;
      holder: string;
      bank: string;
      cbu: string;
      alias: string;
      cuit: string;
    };
    cash: { enabled: boolean };
  };
  contact: { whatsapp: string; instagram: string; email: string; city: string };
  legal: { business_name: string; cuit: string; data_fiscal_url: string };
  size_guide: { size: string; busto: string; cintura: string; cadera: string }[];
  tagline: string;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "expired";

export type PaymentMethod = "mercadopago" | "transfer" | "cash";

export type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  product_slug: string | null;
  image_url: string | null;
  color: string;
  size: string;
  variant_label: string;
  quantity: number;
  unit_price: number;
};

export type Address = {
  street: string;
  number: string;
  floor?: string;
  city: string;
  province: string;
  zip: string;
};

export type Order = {
  id: string;
  number: number;
  access_token?: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  customer_name: string;
  email: string;
  phone: string;
  dni: string | null;
  shipping_method: "delivery" | "pickup";
  shipping_zone: string | null;
  shipping_zone_label: string | null;
  shipping_eta: string | null;
  shipping_branch: string | null;
  address: Address | null;
  notes: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  stock_reserved: boolean;
  stock_conflict: boolean;
  reserved_until: string | null;
  mp_payment_id: string | null;
  tracking_code: string | null;
  admin_notes: string | null;
  paid_at: string | null;
  created_at: string;
  items?: OrderItem[];
};

export type CartLine = {
  /** Una línea por variante (color + talle) */
  key: string;
  variant_id: string;
  product_id: string;
  slug: string;
  name: string;
  image: string | null;
  color: string;
  size: string;
  unit_price: number;
  quantity: number;
};

/** Opción de envío ofrecida en el checkout (siempre calculada por el servidor). */
export type ShippingOption = {
  id: string; // "zona:<id>" | "correo:D" | "correo:S"
  label: string;
  detail: string;
  price: number;
  needs_branch?: boolean;
};

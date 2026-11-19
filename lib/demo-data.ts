import { unsplash as u } from "./defaults";
import type { Category, Product, ProductColor, Variant } from "./types";

/**
 * Catálogo de muestra para la vista previa (cuando no hay base conectada).
 * Fotos de Unsplash sólo de referencia: se reemplazan desde el panel.
 */
export const DEMO_CATEGORIES: Category[] = [
  {
    id: "c-tops",
    slug: "tops",
    name: "Tops & corsets",
    description: "Encaje, transparencias y escotes que se notan.",
    image_url: u("1790069484614-ddc117594a96"),
    sort: 1,
    active: true,
  },
  {
    id: "c-jeans",
    slug: "jeans",
    name: "Jeans",
    description: "Tiro bajo, holgados y con lavados gastados.",
    image_url: u("1762164130276-021d7c91cd89"),
    sort: 2,
    active: true,
  },
  {
    id: "c-vestidos",
    slug: "vestidos",
    name: "Vestidos",
    description: "Para salir, para la previa y para todo lo que venga después.",
    image_url: u("1783013953015-aaf234e7ac27"),
    sort: 3,
    active: true,
  },
  {
    id: "c-minis",
    slug: "minis",
    name: "Minis & shorts",
    description: "Denim, eco cuero y animal print.",
    image_url: u("1709672262857-e7e6da8d1734"),
    sort: 4,
    active: true,
  },
];

const C = {
  negro: { name: "Negro", hex: "#111111" },
  bordo: { name: "Bordó", hex: "#5E1224" },
  marron: { name: "Chocolate", hex: "#4A2C20" },
  azul: { name: "Azul gastado", hex: "#6F8CAD" },
  gris: { name: "Gris lavado", hex: "#8A8D91" },
  leopardo: { name: "Leopardo", hex: "#B98A57" },
  blanco: { name: "Blanco", hex: "#F2F0EC" },
} satisfies Record<string, ProductColor>;

/** stock: una fila por color, en el mismo orden que `sizes` */
function variants(id: string, sizes: string[], rows: [ProductColor, number[]][]): Variant[] {
  return rows.flatMap(([color, stock], ci) =>
    sizes.map((size, si) => ({
      id: `${id}-${ci}-${size}`.toLowerCase(),
      color: color.name,
      size,
      stock: stock[si],
      sort: ci * 100 + si,
    })),
  );
}

const LETRAS = ["S", "M", "L", "XL"];
const JEAN = ["36", "38", "40", "42", "44"];

type Seed = Omit<Product, "images" | "variants" | "category" | "active" | "created_at" | "sort" | "colors"> & {
  imgs: [string, string, string?][];
  rows: [ProductColor, number[]][];
  sizes: string[];
  cat: "tops" | "jeans" | "vestidos" | "minis";
};

const seeds: Seed[] = [
  {
    id: "p-corset-noir",
    slug: "corset-noir",
    name: "Corset Noir",
    category_id: "c-tops",
    cat: "tops",
    price: 32900,
    compare_at_price: null,
    weight_g: 250,
    description: "Corset con cordones al frente y escote corazón. Ajusta en la cintura y queda increíble con jean tiro bajo.",
    details: "Satén elastizado con forrería.\nCordones regulables al frente.\nBallenas flexibles.",
    care: "Lavar a mano con agua fría.\nNo usar secarropas.\nPlanchar del revés a baja temperatura.",
    featured: true,
    imgs: [
      ["1790069484700-2dde2cf6c854", "Corset negro con jean, contra una pared de piedra", "Negro"],
      ["1790069484614-ddc117594a96", "Corset negro visto de cerca", "Negro"],
    ],
    sizes: LETRAS,
    rows: [
      [C.negro, [3, 5, 2, 1]],
      [C.bordo, [0, 2, 1, 0]],
    ],
  },
  {
    id: "p-baggy-2000",
    slug: "baggy-2000",
    name: "Baggy 2000",
    category_id: "c-jeans",
    cat: "jeans",
    price: 45900,
    compare_at_price: 52900,
    weight_g: 700,
    description: "Jean holgado de tiro bajo con lavado gastado. Pierna ancha que cae sobre la zapatilla.",
    details: "Denim 100 % algodón.\nTiro bajo.\nCinco bolsillos.",
    care: "Lavar del revés con agua fría.\nNo usar lavandina.",
    featured: true,
    imgs: [
      ["1762164130276-021d7c91cd89", "Jean holgado azul con campera de cuero", "Azul gastado"],
      ["1788200366432-d027e8961bee", "Jean holgado azul sentada en un muelle", "Azul gastado"],
    ],
    sizes: JEAN,
    rows: [
      [C.azul, [2, 4, 4, 2, 1]],
      [C.gris, [1, 2, 0, 1, 0]],
    ],
  },
  {
    id: "p-vestido-medianoche",
    slug: "vestido-medianoche",
    name: "Vestido Medianoche",
    category_id: "c-vestidos",
    cat: "vestidos",
    price: 58900,
    compare_at_price: null,
    weight_g: 400,
    description: "Vestido largo de encaje con escote corazón y tajo lateral. Para la noche que no querés que termine.",
    details: "Encaje elastizado con forrería corta.\nTajo lateral.\nCierre invisible en la espalda.",
    care: "Lavar a mano con agua fría.\nSecar en plano.",
    featured: true,
    imgs: [
      ["1783013953094-249d033e3cf9", "Vestido largo de encaje negro"],
      ["1783013952887-aaec97f086d6", "Detalle del encaje del vestido negro"],
    ],
    sizes: LETRAS,
    rows: [[C.negro, [1, 3, 2, 1]]],
  },
  {
    id: "p-mini-leopardo",
    slug: "mini-leopardo",
    name: "Pollera Leopardo",
    category_id: "c-minis",
    cat: "minis",
    price: 27900,
    compare_at_price: null,
    weight_g: 220,
    description: "Pollera midi de satén con estampado animal print. Se usa con musculosa básica o con corset.",
    details: "Satén liviano.\nCintura elastizada.\nLargo midi.",
    care: "Lavar a mano.\nPlanchar a baja temperatura.",
    featured: true,
    imgs: [
      ["1762337679789-3a32fdcabc89", "Pollera con estampado de leopardo", "Leopardo"],
      ["1762337676186-70d63d0ed203", "Pollera de leopardo a contraluz", "Leopardo"],
    ],
    sizes: LETRAS,
    rows: [[C.leopardo, [2, 3, 3, 0]]],
  },
  {
    id: "p-baby-tee",
    slug: "baby-tee",
    name: "Baby Tee",
    category_id: "c-tops",
    cat: "tops",
    price: 16900,
    compare_at_price: null,
    weight_g: 150,
    description: "Remera corta y entallada, la base de cualquier look. Con jean holgado es infalible.",
    details: "Algodón con elastano.\nCorte cropped.",
    care: "Lavar con agua fría.\nNo usar secarropas.",
    featured: false,
    imgs: [
      ["1788200588504-daccfcb28860", "Remera corta negra con jean", "Negro"],
      ["1788200588452-a0f4ecbf7622", "Remera corta negra sentada en bloques de cemento", "Negro"],
    ],
    sizes: LETRAS,
    rows: [
      [C.negro, [4, 6, 5, 2]],
      [C.blanco, [2, 3, 3, 1]],
      [C.marron, [0, 0, 0, 0]],
    ],
  },
  {
    id: "p-mini-denim",
    slug: "mini-denim",
    name: "Mini Denim",
    category_id: "c-minis",
    cat: "minis",
    price: 29900,
    compare_at_price: null,
    weight_g: 350,
    description: "Mini de jean tiro bajo con cinturón de tachas. Lavado gris o azul.",
    details: "Denim rígido.\nCinturón con tachas incluido.",
    care: "Lavar del revés con agua fría.",
    featured: true,
    imgs: [
      ["1780566758461-8a2e9287abb2", "Mini de jean con remera gris y cartera", "Azul gastado"],
      ["1709672262857-e7e6da8d1734", "Mini de jean con campera de jean", "Azul gastado"],
    ],
    sizes: JEAN,
    rows: [
      [C.azul, [1, 3, 2, 1, 0]],
      [C.gris, [2, 2, 1, 0, 0]],
    ],
  },
  {
    id: "p-slip-dress",
    slug: "slip-dress",
    name: "Slip Dress",
    category_id: "c-vestidos",
    cat: "vestidos",
    price: 39900,
    compare_at_price: null,
    weight_g: 250,
    description: "Vestido lencero de tiritas con borde de encaje. Corto y liviano, para usar solo o con campera.",
    details: "Satén con borde de encaje.\nTiritas regulables.",
    care: "Lavar a mano con agua fría.",
    featured: false,
    imgs: [
      ["1623609163841-5e69d8c62cc7", "Vestido lencero negro de tiritas en maniquí"],
      ["1786206147603-f886e7e13323", "Chica con vestido negro en una senda peatonal de noche"],
    ],
    sizes: LETRAS,
    rows: [[C.negro, [2, 2, 1, 1]]],
  },
  {
    id: "p-mini-eco-cuero",
    slug: "mini-eco-cuero",
    name: "Mini Eco Cuero",
    category_id: "c-minis",
    cat: "minis",
    price: 31900,
    compare_at_price: null,
    weight_g: 300,
    description: "Mini de eco cuero tiro alto con cierre al costado. Brilla lo justo.",
    details: "Eco cuero con forrería.\nCierre invisible lateral.",
    care: "Limpiar con paño húmedo.\nNo lavar en lavarropas.",
    featured: false,
    imgs: [
      ["1786205418334-5e0c6d00a602", "Mini de eco cuero con remera negra de noche", "Negro"],
      ["1786206089358-ce233fc9d37b", "Chica de negro bajando de un auto de noche", "Negro"],
    ],
    sizes: LETRAS,
    rows: [
      [C.negro, [0, 2, 2, 1]],
      [C.marron, [1, 1, 0, 0]],
    ],
  },
];

export const DEMO_PRODUCTS: Product[] = seeds.map((s, i) => {
  const { imgs, cat, rows, sizes, ...rest } = s;
  const category = DEMO_CATEGORIES.find((c) => c.slug === cat)!;
  return {
    ...rest,
    colors: rows.map(([c]) => c),
    variants: variants(s.id, sizes, rows),
    active: true,
    sort: i,
    created_at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString(),
    category: { slug: category.slug, name: category.name },
    images: imgs.map(([id, alt, color], j) => ({ id: `${s.id}-img-${j}`, url: u(id), alt, color: color ?? null, sort: j })),
  };
});

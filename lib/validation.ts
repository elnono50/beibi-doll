import { z } from "zod";
import { PROVINCES } from "./format";

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max, "Es demasiado largo");

/** Ids reales (uuid) o los de muestra del modo demo */
export const variantIdSchema = z.string().uuid().or(z.string().regex(/^p-[a-z0-9-]{1,80}$/));

export const checkoutItemSchema = z.object({
  variant_id: variantIdSchema,
  quantity: z.number().int().min(1).max(20),
});

export const zipSchema = z.string().trim().regex(/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/, "Código postal inválido");

/** Para cotizar el envío: sólo el CP y qué lleva (el peso se busca en la base). */
export const quoteSchema = z.object({
  zip: zipSchema,
  province: z.enum(PROVINCES as [string, ...string[]]),
  items: z.array(checkoutItemSchema).min(1).max(30),
});

export const addressSchema = z.object({
  street: text(2, 120, "Ingresá la calle"),
  number: text(1, 12, "Ingresá la altura"),
  floor: z.string().trim().max(30).optional().default(""),
  city: text(2, 80, "Ingresá la localidad"),
  province: z.enum(PROVINCES as [string, ...string[]], { message: "Elegí la provincia" }),
  zip: zipSchema,
});

export const checkoutSchema = z
  .object({
    customer_name: text(3, 120, "Ingresá tu nombre y apellido"),
    email: z.string().trim().toLowerCase().email("Revisá el email").max(200),
    phone: z
      .string()
      .trim()
      .transform((s) => s.replace(/[^\d+]/g, ""))
      .pipe(z.string().regex(/^\+?\d{8,15}$/, "Ingresá un teléfono con código de área")),
    dni: z
      .string()
      .trim()
      .transform((s) => s.replace(/\D/g, ""))
      .pipe(z.string().regex(/^(\d{7,8})?$/, "El DNI tiene 7 u 8 números"))
      .optional()
      .default(""),
    shipping_method: z.enum(["delivery", "pickup"]),
    shipping_option: z
      .string()
      .regex(/^(zona:[a-z0-9-]{1,40}|correo:[DS])$/, "Elegí cómo te lo enviamos")
      .optional(),
    shipping_branch: z.string().trim().max(160).optional().default(""),
    address: addressSchema.optional(),
    payment_method: z.enum(["mercadopago", "transfer", "cash"]),
    notes: z.string().trim().max(600).optional().default(""),
    newsletter: z.boolean().optional().default(false),
    items: z.array(checkoutItemSchema).min(1, "Tu bolsa está vacía").max(30),
    website: z.string().max(0).optional(), // trampa para bots
  })
  .superRefine((v, ctx) => {
    if (v.shipping_method === "delivery") {
      if (!v.shipping_option)
        ctx.addIssue({ code: "custom", path: ["shipping_option"], message: "Elegí cómo te lo enviamos" });
      if (!v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Completá la dirección" });
    }
    if (v.payment_method === "cash" && v.shipping_method !== "pickup") {
      ctx.addIssue({ code: "custom", path: ["payment_method"], message: "El efectivo es sólo para retiro" });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const withdrawalSchema = z.object({
  order_number: z.string().trim().regex(/^#?\d{3,10}$/, "Ingresá el número de pedido"),
  name: text(3, 120, "Ingresá tu nombre"),
  email: z.string().trim().toLowerCase().email("Revisá el email").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  reason: z.string().trim().max(2000).optional().default(""),
  website: z.string().max(0).optional(),
});

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { isDemo } from "@/lib/config";
import { browserClient } from "@/lib/supabase/browser";
import { money, PROVINCES } from "@/lib/format";
import { variantLabel } from "@/lib/stock";
import type { PaymentMethod, Settings, ShippingOption } from "@/lib/types";
import { useCart } from "./CartProvider";

type Errors = Record<string, string>;
import { useTurnstile } from "@/components/useTurnstile";

export function CheckoutForm({ settings, demo }: { settings: Settings; demo: boolean }) {
  const { lines, subtotal, ready, clear } = useCart();
  const cf = useTurnstile("checkout");
  const { shipping, payments } = settings;
  const canDeliver = shipping.zones.some((z) => z.enabled) || shipping.carrier.enabled;

  const [method, setMethod] = useState<"delivery" | "pickup">(canDeliver ? "delivery" : "pickup");
  const [zip, setZip] = useState("");
  const [province, setProvince] = useState("");
  const [quote, setQuote] = useState<{ state: "idle" | "loading" | "ok" | "error"; options: ShippingOption[] }>({
    state: "idle",
    options: [],
  });
  const [option, setOption] = useState("");
  const [retry, setRetry] = useState(0);
  const [pay, setPay] = useState<PaymentMethod>(
    payments.mercadopago.enabled ? "mercadopago" : payments.transfer.enabled ? "transfer" : "cash",
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [account, setAccount] = useState<{ email: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Si la clienta tiene sesión, completamos sus datos (sin pisar lo que ya escribió)
  useEffect(() => {
    if (isDemo) return;
    const sb = browserClient();
    sb.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u?.email) return;
      setAccount({ email: u.email });
      const { data: prof } = await sb.from("customers").select("name, phone").eq("user_id", u.id).maybeSingle();
      const fill = (name: string, value?: string | null) => {
        const el = formRef.current?.elements.namedItem(name) as HTMLInputElement | null;
        if (el && !el.value && value) el.value = value;
      };
      fill("email", u.email);
      fill("customer_name", prof?.name);
      fill("phone", prof?.phone);
    });
  }, []);

  useEffect(() => {
    if (pay === "cash" && method !== "pickup") {
      setPay(payments.mercadopago.enabled ? "mercadopago" : "transfer");
    }
  }, [method, pay, payments]);

  // Cotiza el envío cuando hay un código postal válido (y cuando cambia la bolsa)
  const itemsKey = lines.map((l) => `${l.variant_id}x${l.quantity}`).join(",");
  useEffect(() => {
    if (method !== "delivery") return;
    const clean = zip.trim();
    if (!/^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/.test(clean) || !province || !lines.length) {
      setQuote({ state: "idle", options: [] });
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      setQuote((q) => ({ ...q, state: "loading" }));
      try {
        const res = await fetch("/api/envio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zip: clean,
            province,
            items: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
          }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.options)) throw new Error();
        setQuote({ state: "ok", options: data.options });
        setOption((cur) => (data.options.some((o: ShippingOption) => o.id === cur) ? cur : data.options[0]?.id ?? ""));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuote({ state: "error", options: [] });
      }
    }, 450);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip, province, itemsKey, method, retry]);

  const discount =
    pay === "transfer" && payments.transfer.discount_pct > 0
      ? Math.floor((subtotal * payments.transfer.discount_pct) / 100)
      : 0;
  const chosen = quote.options.find((o) => o.id === option);
  const freeShip = Boolean(shipping.free_from && subtotal - discount >= shipping.free_from);
  const shipCost = useMemo(() => {
    if (method === "pickup" || !chosen || freeShip) return 0;
    return chosen.price;
  }, [method, chosen, freeShip]);
  const total = subtotal - discount + shipCost;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const body = {
      customer_name: get("customer_name"),
      email: get("email"),
      phone: get("phone"),
      dni: get("dni"),
      shipping_method: method,
      shipping_option: method === "delivery" ? option || undefined : undefined,
      shipping_branch: method === "delivery" && chosen?.needs_branch ? get("branch") : "",
      address:
        method === "delivery"
          ? {
              street: get("street"),
              number: get("number"),
              floor: get("floor"),
              city: get("city"),
              province: get("province"),
              zip: get("zip"),
            }
          : undefined,
      payment_method: pay,
      notes: get("notes"),
      newsletter: fd.get("newsletter") === "1",
      website: get("website"),
      items: lines.map((l) => ({ variant_id: l.variant_id, quantity: l.quantity })),
    };
    setSending(true);
    try {
      const cf_token = await cf.getToken();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, cf_token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        cf.reset();
        if (data.shipping?.options) {
          setQuote({ state: "ok", options: data.shipping.options });
          setOption("");
        }
        if (data.fields) {
          setErrors(data.fields);
          const first = Object.keys(data.fields)[0];
          document.querySelector<HTMLElement>(`[name="${first.replace("address.", "")}"]`)?.focus();
        }
        setFormError(data.error || "No pudimos crear el pedido. Revisá los datos e intentá de nuevo.");
        setSending(false);
        return;
      }
      clear();
      window.location.assign(data.redirect);
    } catch {
      setFormError("Se cortó la conexión. Revisá tu internet e intentá de nuevo.");
      setSending(false);
    }
  }

  if (ready && lines.length === 0) {
    return (
      <div className="empty">
        <h1 style={{ fontSize: "var(--t-4xl)" }}>Tu bolsa está vacía</h1>
        <p>Elegí tus prendas y volvé acá para terminar la compra.</p>
        <Link href="/tienda" className="btn">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  const inv = (k: string) => (errors[k] ? true : undefined);
  const submitLabel = sending
    ? "Creando tu pedido…"
    : pay === "mercadopago"
      ? "Pagar con Mercado Pago"
      : "Confirmar pedido";

  return (
    <form
      ref={formRef}
      className="checkout"
      onSubmit={onSubmit}
      noValidate
      onInput={(e) => {
        const name = (e.target as HTMLInputElement).name;
        if (!name) return;
        const keys = [name, `address.${name}`];
        if (keys.some((k) => errors[k])) setErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !keys.includes(k))));
      }}
    >
      <div>
        <h1>Finalizar compra</h1>
        <p style={{ color: "var(--sea-soft)", marginBottom: 24 }}>
          Te guardamos las prendas mientras completás el pago.{" "}
          {account ? (
            <>El pedido queda guardado en tu cuenta.</>
          ) : (
            <>
              ¿Ya tenés cuenta? <Link href="/cuenta/ingresar">Ingresá</Link> para seguir tus pedidos.
            </>
          )}
        </p>

        <div className="hp" aria-hidden="true">
          <label>
            No completar
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <section className="form-block" aria-labelledby="c-contact">
          <h2 id="c-contact">Tus datos</h2>
          <div className="form-grid">
            <label className="field span-6">
              <span>Nombre y apellido</span>
              <input className="input" name="customer_name" autoComplete="name" required aria-invalid={inv("customer_name")} />
              {err("customer_name") && <span className="field-error">{err("customer_name")}</span>}
            </label>
            <label className="field span-3">
              <span>Email</span>
              <input className="input" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={inv("email")} />
              {err("email") && <span className="field-error">{err("email")}</span>}
            </label>
            <label className="field span-3">
              <span>Teléfono</span>
              <input className="input" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="11 2345 6789" required aria-invalid={inv("phone")} />
              {err("phone") && <span className="field-error">{err("phone")}</span>}
            </label>
            <label className="field span-3">
              <span>DNI</span>
              <input className="input" name="dni" inputMode="numeric" autoComplete="off" aria-invalid={inv("dni")} />
              <small>Lo pide el correo para entregar.</small>
              {err("dni") && <span className="field-error">{err("dni")}</span>}
            </label>
          </div>
        </section>

        <section className="form-block" aria-labelledby="c-ship">
          <h2 id="c-ship">Entrega</h2>
          <div className="choices choices--2" role="radiogroup" aria-labelledby="c-ship">
            {canDeliver && (
              <label className="choice">
                <input type="radio" name="ship" checked={method === "delivery"} onChange={() => setMethod("delivery")} />
                <span>
                  <b>Envío a todo el país</b>
                  <small>A domicilio o a sucursal</small>
                </span>
              </label>
            )}
            {shipping.pickup.enabled && (
              <label className="choice">
                <input type="radio" name="ship" checked={method === "pickup"} onChange={() => setMethod("pickup")} />
                <span>
                  <b>Retiro en el local</b>
                  <small>
                    {shipping.pickup.address}
                    {shipping.pickup.hours ? `. ${shipping.pickup.hours}` : ""}
                  </small>
                </span>
                <span className="choice__price">Gratis</span>
              </label>
            )}
          </div>

          {method === "delivery" && (
            <>
              <div className="form-grid" style={{ marginTop: 8 }}>
                <label className="field span-2">
                  <span>Código postal</span>
                  <input
                    className="input"
                    name="zip"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    placeholder="5400"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.slice(0, 8))}
                    aria-invalid={inv("address.zip")}
                    aria-describedby="zip-help"
                  />
                  <small id="zip-help">Con la provincia y el código postal calculamos el envío.</small>
                  {err("address.zip") && <span className="field-error">{err("address.zip")}</span>}
                </label>
                <label className="field span-4">
                  <span>Provincia</span>
                  <select
                    className="select input"
                    name="province"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    aria-invalid={inv("address.province")}
                  >
                    <option value="" disabled>
                      Elegí una opción
                    </option>
                    {PROVINCES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  {err("address.province") && <span className="field-error">{err("address.province")}</span>}
                </label>
              </div>

              <div className="ship-quote" aria-live="polite">
                {quote.state === "idle" && (
                  <p className="ship-quote__hint">Elegí tu provincia e ingresá tu código postal para ver cuánto sale el envío.</p>
                )}
                {quote.state === "loading" && (
                  <p className="ship-quote__hint">
                    <span className="spinner" aria-hidden="true" /> Calculando el envío…
                  </p>
                )}
                {quote.state === "error" && (
                  <p className="notice notice--error">
                    No pudimos calcular el envío.{" "}
                    <button type="button" className="link" onClick={() => setRetry((n) => n + 1)}>
                      Probá de nuevo
                    </button>
                  </p>
                )}
                {quote.state === "ok" && quote.options.length === 0 && (
                  <p className="notice">No tenemos envíos cargados para esa provincia. Escribinos o elegí retiro en el local.</p>
                )}
                {quote.state === "ok" && quote.options.length > 0 && (
                  <div className="choices" role="radiogroup" aria-label="Opciones de envío">
                    {quote.options.map((o) => (
                      <label className="choice" key={o.id}>
                        <input type="radio" name="ship_option" checked={option === o.id} onChange={() => setOption(o.id)} />
                        <span>
                          <b>{o.label}</b>
                          <small>{o.detail}</small>
                        </span>
                        <span className="choice__price">{freeShip ? "Gratis" : money(o.price)}</span>
                      </label>
                    ))}
                  </div>
                )}
                {err("shipping_option") && <span className="field-error">{err("shipping_option")}</span>}
              </div>

              <div className="form-grid">
                {chosen?.needs_branch && (
                  <label className="field span-6">
                    <span>Sucursal donde lo retirás</span>
                    <input
                      className="input"
                      name="branch"
                      maxLength={160}
                      placeholder="Ej.: sucursal Rivadavia, Av. Libertador 1234"
                      aria-invalid={inv("shipping_branch")}
                    />
                    <small>Si no la sabés, poné tu localidad y te escribimos para elegirla.</small>
                    {err("shipping_branch") && <span className="field-error">{err("shipping_branch")}</span>}
                  </label>
                )}
                <label className="field span-4">
                  <span>{chosen?.needs_branch ? "Tu dirección (calle)" : "Calle"}</span>
                  <input className="input" name="street" autoComplete="address-line1" aria-invalid={inv("address.street")} />
                  {err("address.street") && <span className="field-error">{err("address.street")}</span>}
                </label>
                <label className="field span-2">
                  <span>Altura</span>
                  <input className="input" name="number" inputMode="numeric" aria-invalid={inv("address.number")} />
                  {err("address.number") && <span className="field-error">{err("address.number")}</span>}
                </label>
                <label className="field span-2">
                  <span>Piso y depto</span>
                  <input className="input" name="floor" autoComplete="address-line2" />
                </label>
                <label className="field span-4">
                  <span>Localidad</span>
                  <input className="input" name="city" autoComplete="address-level2" aria-invalid={inv("address.city")} />
                  {err("address.city") && <span className="field-error">{err("address.city")}</span>}
                </label>
              </div>
            </>
          )}
        </section>

        <section className="form-block" aria-labelledby="c-pay">
          <h2 id="c-pay">Pago</h2>
          <div className="choices" role="radiogroup" aria-labelledby="c-pay">
            {payments.mercadopago.enabled && (
              <label className="choice">
                <input type="radio" name="pay" checked={pay === "mercadopago"} onChange={() => setPay("mercadopago")} />
                <span>
                  <b>Mercado Pago</b>
                  <small>Tarjeta de crédito, débito o dinero en cuenta. Te llevamos a Mercado Pago para pagar.</small>
                </span>
              </label>
            )}
            {payments.transfer.enabled && (
              <label className="choice">
                <input type="radio" name="pay" checked={pay === "transfer"} onChange={() => setPay("transfer")} />
                <span>
                  <b>Transferencia bancaria</b>
                  <small>Te mostramos el alias al confirmar. Guardamos tu pedido 48 h.</small>
                </span>
                {payments.transfer.discount_pct > 0 && (
                  <span className="choice__price">−{payments.transfer.discount_pct}%</span>
                )}
              </label>
            )}
            {payments.cash.enabled && shipping.pickup.enabled && (
              <label className="choice">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === "cash"}
                  disabled={method !== "pickup"}
                  onChange={() => setPay("cash")}
                />
                <span>
                  <b>Efectivo al retirar</b>
                  <small>{method === "pickup" ? "Pagás cuando venís a buscarlo." : "Disponible sólo con retiro."}</small>
                </span>
              </label>
            )}
          </div>
          {err("payment_method") && <span className="field-error">{err("payment_method")}</span>}

          <label className="field" style={{ marginTop: 8 }}>
            <span>Notas para el pedido (opcional)</span>
            <textarea className="textarea" name="notes" maxLength={600} rows={3} />
          </label>
          <label className="news__consent" style={{ marginTop: 4 }}>
            <input type="checkbox" name="newsletter" value="1" />
            <span>Quiero recibir novedades y promos de Beibi Doll por email.</span>
          </label>
        </section>
      </div>

      <aside className="summary" aria-labelledby="s-title">
        <h2 id="s-title">Tu pedido</h2>
        <div>
          {lines.map((l) => (
            <div className="line" key={l.key} style={{ gridTemplateColumns: "56px 1fr" }}>
              <div className="line__img">{l.image && <Image src={l.image} alt="" fill sizes="56px" />}</div>
              <div className="line__info">
                <div className="line__top">
                  <span className="line__name" style={{ fontSize: "var(--t-md)" }}>
                    {l.name} {l.quantity > 1 && <small>× {l.quantity}</small>}
                  </span>
                  <span className="price" style={{ fontSize: "var(--t-sm)" }}>
                    {money(l.unit_price * l.quantity)}
                  </span>
                </div>
                <span className="line__meta">{variantLabel(l.color, l.size)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="sum-row">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="sum-row">
            <span>Descuento por transferencia</span>
            <span>−{money(discount)}</span>
          </div>
        )}
        <div className="sum-row">
          <span>Envío</span>
          <span>
            {method === "pickup" || freeShip ? "Gratis" : chosen ? money(shipCost) : "A calcular"}
          </span>
        </div>
        <div className="sum-row sum-row--total">
          <span>Total</span>
          <span>{money(total)}</span>
        </div>

        {formError && (
          <p className="notice notice--error" role="alert">
            {formError}
          </p>
        )}
        {demo && <p className="notice">Vista previa: el pedido se simula y no se cobra nada.</p>}

        <button
          className="btn btn--block"
          type="submit"
          disabled={sending || !ready || (method === "delivery" && quote.state === "loading")}
        >
          {submitLabel}
        </button>
        <p style={{ fontSize: "var(--t-xs)", color: "var(--sea-mute)" }}>
          Al confirmar aceptás los <Link href="/ayuda/terminos">términos y condiciones</Link> y la{" "}
          <Link href="/ayuda/privacidad">política de privacidad</Link>.
        </p>
      </aside>
      {cf.slot}
    </form>
  );
}

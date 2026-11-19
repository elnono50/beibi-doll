"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSettings } from "@/app/admin/actions";
import type { Settings } from "@/lib/types";
import { ShippingZones } from "./ShippingZones";
import { SaveMessage, useSave } from "./useSave";

const num = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

export function SettingsForm({ settings, mpReady }: { settings: Settings; mpReady: boolean }) {
  const router = useRouter();
  const { pending, msg, run } = useSave();
  const [s, setS] = useState<Settings>(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const ship = s.shipping;
  const pay = s.payments;

  return (
    <div className="form-stack" style={{ gap: 24 }}>
      <div className="two-col">
        <section className="panel">
          <h2>Envíos</h2>
          <p className="panel__hint">
            Cargá la tabla de tu empresa de envíos (por ejemplo Vía Cargo). La tienda elige sola la tarifa según la provincia
            de la clienta y el peso de la compra.
          </p>
          <ShippingZones zones={ship.zones} onChange={(zones) => set("shipping", { ...ship, zones })} />
          <div className="row-2">
            <label className="field">
              <span>Envío gratis desde</span>
              <input
                className="input"
                inputMode="numeric"
                value={ship.free_from ?? ""}
                placeholder="Sin envío gratis"
                onChange={(e) => set("shipping", { ...ship, free_from: e.target.value.trim() ? num(e.target.value) : null })}
              />
              <small>Dejalo vacío para no ofrecerlo.</small>
            </label>
            <label className="field">
              <span>Aviso de despacho</span>
              <input className="input" value={ship.eta} maxLength={200} onChange={(e) => set("shipping", { ...ship, eta: e.target.value })} />
            </label>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={ship.pickup.enabled}
              onChange={(e) => set("shipping", { ...ship, pickup: { ...ship.pickup, enabled: e.target.checked } })}
            />
            <span>Ofrecer retiro sin cargo</span>
          </label>
          {ship.pickup.enabled && (
            <div className="row-2">
              <label className="field">
                <span>Dónde se retira</span>
                <input
                  className="input"
                  value={ship.pickup.address}
                  maxLength={200}
                  onChange={(e) => set("shipping", { ...ship, pickup: { ...ship.pickup, address: e.target.value } })}
                />
                <small>Se ve en el checkout. Si no querés publicar la dirección, poné el barrio.</small>
              </label>
              <label className="field">
                <span>Horarios</span>
                <input
                  className="input"
                  value={ship.pickup.hours}
                  maxLength={120}
                  onChange={(e) => set("shipping", { ...ship, pickup: { ...ship.pickup, hours: e.target.value } })}
                />
              </label>
            </div>
          )}

          <div className="subpanel">
            <label className="toggle">
              <input
                type="checkbox"
                checked={ship.carrier.enabled}
                onChange={(e) => set("shipping", { ...ship, carrier: { ...ship.carrier, enabled: e.target.checked } })}
              />
              <span>
                Sumar Correo Argentino con precio en tiempo real
                <small>Necesita una cuenta MiCorreo con acceso a la API. Se ofrece junto a tus tarifas.</small>
              </span>
            </label>
            {ship.carrier.enabled && (
              <>
                <div className="row-2">
                  <label className="field">
                    <span>Código postal desde donde despachás</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      maxLength={4}
                      value={ship.carrier.origin_zip}
                      onChange={(e) =>
                        set("shipping", { ...ship, carrier: { ...ship.carrier, origin_zip: e.target.value.replace(/\D/g, "").slice(0, 4) } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Sumar al precio del correo</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={ship.carrier.extra}
                      onChange={(e) => set("shipping", { ...ship, carrier: { ...ship.carrier, extra: num(e.target.value) } })}
                    />
                    <small>Por ejemplo, el costo del embalaje. 0 para cobrar lo mismo que el correo.</small>
                  </label>
                </div>
                <div className="row-2">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={ship.carrier.home}
                      onChange={(e) => set("shipping", { ...ship, carrier: { ...ship.carrier, home: e.target.checked } })}
                    />
                    <span>A domicilio</span>
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={ship.carrier.branch}
                      onChange={(e) => set("shipping", { ...ship, carrier: { ...ship.carrier, branch: e.target.checked } })}
                    />
                    <span>A sucursal</span>
                  </label>
                </div>
                <fieldset className="field">
                  <span>Medidas de la caja que usás (cm)</span>
                  <div className="row-3">
                    {(["length", "width", "height"] as const).map((d) => (
                      <label key={d} className="field">
                        <small>{d === "length" ? "Largo" : d === "width" ? "Ancho" : "Alto"}</small>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={ship.carrier.package[d]}
                          onChange={(e) =>
                            set("shipping", {
                              ...ship,
                              carrier: {
                                ...ship.carrier,
                                package: { ...ship.carrier.package, [d]: Math.max(1, Math.min(150, num(e.target.value))) },
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Medios de pago</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={pay.mercadopago.enabled}
              onChange={(e) => set("payments", { ...pay, mercadopago: { enabled: e.target.checked } })}
            />
            <span>
              Mercado Pago
              <small>
                {mpReady
                  ? "Tarjetas y dinero en cuenta. El pedido se marca pagado solo."
                  : "Tarjetas y dinero en cuenta. Aparece en la tienda cuando se vincula tu cuenta de Mercado Pago."}
              </small>
            </span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={pay.transfer.enabled}
              onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, enabled: e.target.checked } })}
            />
            <span>
              Transferencia
              <small>Confirmás el pago a mano en Pedidos cuando te llega el comprobante.</small>
            </span>
          </label>
          {pay.transfer.enabled && (
            <div className="form-stack" style={{ paddingLeft: 52 }}>
              <div className="row-2">
                <label className="field">
                  <span>Alias</span>
                  <input className="input" value={pay.transfer.alias} maxLength={20} onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, alias: e.target.value.trim() } })} />
                </label>
                <label className="field">
                  <span>Descuento (%)</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={pay.transfer.discount_pct}
                    onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, discount_pct: Math.min(50, num(e.target.value)) } })}
                  />
                </label>
              </div>
              <label className="field">
                <span>CBU o CVU</span>
                <input className="input" inputMode="numeric" value={pay.transfer.cbu} maxLength={22} onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, cbu: e.target.value.replace(/\D/g, "") } })} />
              </label>
              <div className="row-3">
                <label className="field">
                  <span>Titular</span>
                  <input className="input" value={pay.transfer.holder} maxLength={120} onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, holder: e.target.value } })} />
                </label>
                <label className="field">
                  <span>Banco</span>
                  <input className="input" value={pay.transfer.bank} maxLength={80} onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, bank: e.target.value } })} />
                </label>
                <label className="field">
                  <span>CUIT</span>
                  <input className="input" value={pay.transfer.cuit} maxLength={20} onChange={(e) => set("payments", { ...pay, transfer: { ...pay.transfer, cuit: e.target.value } })} />
                </label>
              </div>
            </div>
          )}
          <label className="toggle">
            <input type="checkbox" checked={pay.cash.enabled} onChange={(e) => set("payments", { ...pay, cash: { enabled: e.target.checked } })} />
            <span>
              Efectivo al retirar
              <small>Sólo aparece si el retiro está activo.</small>
            </span>
          </label>
        </section>
      </div>

      <div className="two-col">
        <section className="panel">
          <h2>Contacto</h2>
          <div className="row-2">
            <label className="field">
              <span>WhatsApp</span>
              <input
                className="input"
                inputMode="numeric"
                value={s.contact.whatsapp}
                placeholder="5491122334455"
                onChange={(e) => set("contact", { ...s.contact, whatsapp: e.target.value.replace(/\D/g, "") })}
              />
              <small>Con 549 y el código de área, sin 0 ni 15.</small>
            </label>
            <label className="field">
              <span>Instagram</span>
              <input className="input" value={s.contact.instagram} onChange={(e) => set("contact", { ...s.contact, instagram: e.target.value.replace(/^@/, "").trim() })} />
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" value={s.contact.email} onChange={(e) => set("contact", { ...s.contact, email: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>Ciudad</span>
              <input className="input" value={s.contact.city} maxLength={80} onChange={(e) => set("contact", { ...s.contact, city: e.target.value })} />
            </label>
          </div>
        </section>

        <section className="panel">
          <h2>Datos legales</h2>
          <p className="panel__hint">Se muestran en el pie de página y en los términos.</p>
          <label className="field">
            <span>Razón social o nombre</span>
            <input className="input" value={s.legal.business_name} maxLength={120} onChange={(e) => set("legal", { ...s.legal, business_name: e.target.value })} />
          </label>
          <label className="field">
            <span>CUIT</span>
            <input className="input" value={s.legal.cuit} maxLength={20} onChange={(e) => set("legal", { ...s.legal, cuit: e.target.value })} />
          </label>
          <label className="field">
            <span>Enlace del Data Fiscal de ARCA</span>
            <input className="input" type="url" value={s.legal.data_fiscal_url} placeholder="https://servicios1.afip.gob.ar/clavefiscal/qr/…" onChange={(e) => set("legal", { ...s.legal, data_fiscal_url: e.target.value.trim() })} />
          </label>
        </section>
      </div>

      <section className="panel">
        <h2>Guía de talles</h2>
        <p className="panel__hint">Medidas del cuerpo en centímetros. En el celular deslizá la tabla hacia los costados.</p>
        <div className="table-wrap">
          <table className="atable atable--guide">
            <thead>
              <tr>
                <th scope="col">Talle</th>
                <th scope="col">Busto</th>
                <th scope="col">Cintura</th>
                <th scope="col">Cadera</th>
                <th scope="col">
                  <span className="visually-hidden">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.size_guide.map((r, i) => {
                const upd = (k: keyof typeof r, v: string) =>
                  set("size_guide", s.size_guide.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                return (
                  <tr key={i}>
                    {(["size", "busto", "cintura", "cadera"] as const).map((k) => (
                      <td key={k}>
                        <input className="input" value={r[k]} maxLength={k === "size" ? 12 : 20} aria-label={k} onChange={(e) => upd(k, e.target.value)} />
                      </td>
                    ))}
                    <td>
                      <button type="button" className="link" onClick={() => set("size_guide", s.size_guide.filter((_, j) => j !== i))}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ justifySelf: "start" }}
          onClick={() => set("size_guide", [...s.size_guide, { size: "", busto: "", cintura: "", cadera: "" }])}
        >
          Agregar talle
        </button>
      </section>

      <div className="savebar">
        <SaveMessage msg={msg} />
        <button
          className="btn"
          disabled={pending}
          onClick={() =>
            run(
              () =>
                saveSettings({
                  shipping: s.shipping,
                  payments: s.payments,
                  contact: s.contact,
                  legal: s.legal,
                  size_guide: s.size_guide.filter((r) => r.size.trim()),
                }),
              "Ajustes guardados",
              () => router.refresh(),
            )
          }
        >
          {pending ? "Guardando…" : "Guardar ajustes"}
        </button>
      </div>
    </div>
  );
}

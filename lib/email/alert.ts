import "server-only";
import { isDemo } from "../config";
import { getSettings } from "../data";
import { limit } from "../security";
import { adminRecipients, emailEnabled, sendMail } from "./send";
import { adminSystemAlert } from "./templates";

const when = () => new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });

/**
 * Avisa por mail a la tienda que algo falló (checkout, pago de Mercado Pago…).
 * Como máximo un mail por hora por tipo, para no llenar la casilla.
 * Nunca lanza: un aviso fallido no puede romper nada.
 */
export async function alertAdmin(kind: string, what: string, detail: unknown) {
  try {
    console.error(`[alerta:${kind}]`, what, detail);
    if (isDemo || !emailEnabled()) return;
    const to = adminRecipients();
    if (!to.length) return;
    if (!(await limit(`alerta:${kind}`, 1, 60 * 60 * 1000))) return;
    const text = detail instanceof Error ? detail.message : typeof detail === "string" ? detail : JSON.stringify(detail);
    const m = adminSystemAlert({ what, detail: (text ?? "").slice(0, 1500), at: when() }, await getSettings());
    await sendMail({ to, ...m });
  } catch (e) {
    console.error("alertAdmin", (e as Error).message);
  }
}

export { when as nowAR };

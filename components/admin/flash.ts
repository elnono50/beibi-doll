/** Aviso flotante que sobrevive a que el formulario se vuelva a montar. */
export function flash(text: string, tone: "ok" | "error" = "ok") {
  const el = document.createElement("div");
  el.className = `toast${tone === "error" ? " toast--error" : ""}`;
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.textContent = text;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 3800);
}

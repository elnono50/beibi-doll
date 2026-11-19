/**
 * Logo de Beibi Doll (el de su Instagram), recortado sobre fondo transparente.
 * El alto lo da el CSS de cada lugar con --logo-h; el ancho sale solo.
 * Dentro de un enlace que ya tiene aria-label, pasar alt="" para no leerlo dos veces.
 */
export function Logo({ alt = "Beibi Doll", className = "", eager = false }: { alt?: string; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen fija y liviana; no hace falta el optimizador
    <img
      className={`brand-logo ${className}`}
      src="/brand/logo-400.webp"
      srcSet="/brand/logo-400.webp 1x, /brand/logo-800.webp 2x"
      width={400}
      height={145}
      alt={alt}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
    />
  );
}

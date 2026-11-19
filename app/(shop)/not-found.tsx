import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="empty" style={{ paddingBlock: "96px" }}>
        <h1 style={{ fontSize: "var(--t-5xl)" }}>Esta página se la llevó la marea</h1>
        <p>El enlace puede estar mal escrito o el producto ya no está a la venta.</p>
        <Link href="/tienda" className="btn">
          Ir a la tienda
        </Link>
      </div>
    </div>
  );
}

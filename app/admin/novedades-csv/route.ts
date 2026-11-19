import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/config";
import { requireAdmin } from "@/lib/auth";
import { listSubscribers } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

// Evita inyección de fórmulas al abrir el CSV en Excel o Sheets
const cell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  let db;
  try {
    db = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { rows } = await listSubscribers(db);
  const active = rows.filter((r) => !r.unsubscribed_at);
  const lines = [
    ["email", "nombre", "origen", "fecha_alta", "baja"].join(","),
    ...active.map((r) =>
      [r.email, r.name, r.source, r.consent_at, `${SITE_URL}/baja?t=${r.unsubscribe_token}`].map(cell).join(","),
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="beibidoll-novedades-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

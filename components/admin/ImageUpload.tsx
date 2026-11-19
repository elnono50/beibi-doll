"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

const MAX_SIDE = 2000;
const MAX_INPUT = 25 * 1024 * 1024;

/** Achica la foto, la pasa a WebP y de paso le borra los metadatos (ubicación GPS, etc). */
async function optimize(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.86));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return blob;
}

export type Uploaded = { url: string; path: string };

export function ImageUpload({
  folder,
  onUploaded,
  multiple,
  demo,
  label = "Subir fotos",
  wide,
}: {
  folder: "productos" | "inicio" | "lineas";
  onUploaded: (files: Uploaded[]) => void;
  multiple?: boolean;
  demo?: boolean;
  label?: string;
  wide?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);

  async function handle(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    if (demo) {
      setError("En la vista previa no se pueden subir fotos.");
      return;
    }
    const files = Array.from(list).slice(0, multiple ? 10 : 1);
    const bad = files.find((f) => !/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(f.type) || f.size > MAX_INPUT);
    if (bad) {
      setError(`"${bad.name}" no es una foto válida o pesa más de 25 MB.`);
      return;
    }
    setBusy(true);
    const sb = browserClient();
    const out: Uploaded[] = [];
    try {
      for (const f of files) {
        const blob = await optimize(f);
        const path = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await sb.storage
          .from("media")
          .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (upErr) throw new Error(upErr.message);
        out.push({ path, url: sb.storage.from("media").getPublicUrl(path).data.publicUrl });
      }
      onUploaded(out);
    } catch (e) {
      const m = (e as Error).message;
      setError(
        m.includes("row-level security") || m.includes("Unauthorized")
          ? "Tu sesión no tiene permiso para subir fotos. Volvé a ingresar."
          : "No se pudo subir la foto. Si es de iPhone, probá exportarla como JPG.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        className={`dropzone${wide ? " dropzone--wide" : ""}${over ? " is-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          multiple={multiple}
          disabled={busy}
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
        <span>
          <b style={{ fontWeight: 500, display: "block" }}>{busy ? "Subiendo…" : label}</b>
          <small>Arrastrá o tocá para elegir</small>
        </span>
      </label>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

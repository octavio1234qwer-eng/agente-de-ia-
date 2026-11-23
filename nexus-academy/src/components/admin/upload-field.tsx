"use client";
import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bucket: "course-covers" | "course-videos" | "course-materials" | "avatars";
  pathPrefix: string;
  accept: string;
  maxMb: number;
  label: string;
  onUploaded: (result: { path: string; publicUrl: string | null; file: File }) => void | Promise<void>;
};

/** Sube el archivo directo del navegador a Supabase Storage con la sesión del admin (RLS de storage). */
export function UploadField({ bucket, pathPrefix, accept, maxMb, label, onUploaded }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) return setMsg({ ok: false, text: `El archivo supera ${maxMb} MB.` });
    setBusy(true);
    setMsg(null);
    const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "-").toLowerCase().slice(-80);
    const path = `${pathPrefix}/${Date.now()}-${safe}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) {
      setBusy(false);
      return setMsg({ ok: false, text: `No se pudo subir: ${error.message}` });
    }
    const publicUrl = bucket === "course-covers" || bucket === "avatars" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
    await onUploaded({ path, publicUrl, file });
    setBusy(false);
    setMsg({ ok: true, text: `«${file.name}» subido.` });
  }

  return (
    <div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={onChange} />
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06] disabled:opacity-60">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? "Subiendo…" : label}
      </button>
      <p className="mt-1 text-xs text-mist-500">Máximo {maxMb} MB</p>
      {msg && <p role="status" className={`mt-1 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
    </div>
  );
}

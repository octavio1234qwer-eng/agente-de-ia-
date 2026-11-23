"use client";
import { useRef, useState } from "react";
import { LoaderCircle, Upload, X } from "lucide-react";
import * as tus from "tus-js-client";
import { createClient } from "@/lib/supabase/client";

type Props = {
  bucket: "course-covers" | "course-videos" | "course-materials" | "avatars";
  pathPrefix: string;
  accept: string;
  maxMb: number;
  label: string;
  onUploaded: (result: { path: string; publicUrl: string | null; file: File }) => void | Promise<void>;
};

/** Supabase exige bloques de exactamente 6 MB en subidas reanudables (protocolo TUS). */
const CHUNK = 6 * 1024 * 1024;

/**
 * Sube archivos directo del navegador a Supabase Storage con la sesión del admin
 * (las políticas de storage verifican el rol). Los archivos de más de 6 MB usan
 * subida reanudable: si se corta la conexión, continúa donde iba.
 */
export function UploadField({ bucket, pathPrefix, accept, maxMb, label, onUploaded }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const current = useRef<tus.Upload | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [canPause, setCanPause] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function resumable(file: File, path: string): Promise<string> {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: CHUNK,
        metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
        onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
        onError: (err) => reject(err),
        onSuccess: () => resolve((upload.options.metadata?.objectName as string) ?? path),
      });
      current.current = upload;
      setCanPause(true);
      // Si este mismo archivo se subió a medias antes, retoma esa subida (y su ruta).
      upload.findPreviousUploads().then((previous) => {
        const match = previous.find((p) => p.metadata?.bucketName === bucket && p.metadata?.objectName?.startsWith(`${pathPrefix}/`));
        if (match) {
          upload.options.metadata = { ...upload.options.metadata, objectName: match.metadata.objectName };
          upload.resumeFromPreviousUpload(match);
        }
        upload.start();
      });
    });
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) return setMsg({ ok: false, text: `El archivo supera ${maxMb} MB.` });
    setBusy(true);
    setMsg(null);
    setProgress(null);
    const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "-").toLowerCase().slice(-80);
    let path = `${pathPrefix}/${Date.now()}-${safe}`;
    const supabase = createClient();
    try {
      if (file.size > CHUNK) {
        setProgress(0);
        path = await resumable(file, path);
      } else {
        const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) throw error;
      }
    } catch (err) {
      setBusy(false);
      setProgress(null);
      const text = err instanceof Error ? err.message : String(err);
      return setMsg({ ok: false, text: /413|too large|exceeded/i.test(text) ? "El archivo supera el límite de tu plan de almacenamiento." : `No se pudo subir: ${text.slice(0, 160)}` });
    } finally {
      current.current = null;
      setCanPause(false);
    }
    const publicUrl = bucket === "course-covers" || bucket === "avatars" ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
    await onUploaded({ path, publicUrl, file });
    setBusy(false);
    setProgress(null);
    setMsg({ ok: true, text: `«${file.name}» subido.` });
  }

  return (
    <div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={onChange} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06] disabled:opacity-60">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />} {busy ? (progress !== null ? `Subiendo… ${progress}%` : "Subiendo…") : label}
        </button>
        {busy && canPause && (
          <button
            type="button"
            onClick={() => {
              void current.current?.abort();
              setCanPause(false);
              setBusy(false);
              setProgress(null);
              setMsg({ ok: false, text: "Subida pausada. Vuelve a elegir el mismo archivo para continuar donde se quedó." });
            }}
            className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm text-mist-300 hover:bg-white/[0.06]"
          >
            <X className="size-4" /> Pausar
          </button>
        )}
      </div>
      {progress !== null && (
        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la subida">
          <div className="h-full rounded-full bg-gradient-to-r from-electric-500 to-violet-500 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="mt-1 text-xs text-mist-500">Máximo {maxMb >= 1024 ? `${maxMb / 1024} GB` : `${maxMb} MB`}{maxMb > 6 ? " · los archivos grandes se suben en partes y se pueden reanudar" : ""}</p>
      {msg && <p role="status" className={`mt-1 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
    </div>
  );
}

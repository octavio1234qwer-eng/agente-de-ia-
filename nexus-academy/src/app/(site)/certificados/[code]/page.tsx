import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BadgeCheck, Download, Share2, ShieldAlert } from "lucide-react";
import { linkedInShareUrl } from "@/lib/certificates/linkedin";
import { getPublicCertificate } from "@/lib/data/certificates";
import { formatDate } from "@/lib/utils";
import { CopyLink } from "@/components/ui/copy-link";

type Params = { code: string };
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { code } = await params;
  const cert = await getPublicCertificate(code);
  if (!cert) notFound();
  const title = `Certificado de ${cert.student_name} · ${cert.course_title}`;
  const description = cert.revoked_at
    ? "Este certificado de NEXUS ACADEMY fue revocado."
    : `${cert.student_name} completó «${cert.course_title}» en NEXUS ACADEMY. Certificado verificable con ID ${cert.code}.`;
  return {
    title,
    description,
    robots: { index: false },
    alternates: { canonical: `/certificados/${cert.code}` },
    openGraph: { title, description, type: "website", url: `/certificados/${cert.code}`, siteName: "NEXUS ACADEMY" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CertificatePage({ params }: { params: Promise<Params> }) {
  const { code } = await params;
  const cert = await getPublicCertificate(code);
  if (!cert) notFound();
  const url = `${siteUrl}/certificados/${cert.code}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#05060b", light: "#ffffff" } });
  const revoked = Boolean(cert.revoked_at);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className={`mb-6 flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm ${revoked ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"}`}>
        {revoked ? <ShieldAlert className="size-5" /> : <BadgeCheck className="size-5" />}
        {revoked ? "Este certificado fue revocado y ya no es válido." : "Certificado auténtico emitido por NEXUS ACADEMY."}
      </div>

      <article className="glass-strong glow-border relative overflow-hidden rounded-[28px] p-8 sm:p-14" aria-label="Certificado">
        <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-electric-600/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="relative text-center">
          <p className="text-xs font-semibold tracking-[0.5em] text-electric-300">NEXUS ACADEMY</p>
          <h1 className="mt-6 text-2xl font-semibold tracking-[0.18em] text-white sm:text-3xl">CERTIFICADO DE FINALIZACIÓN</h1>
          <p className="mt-8 text-mist-300">Se otorga el presente certificado a</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-gradient sm:text-5xl">{cert.student_name}</p>
          <p className="mt-6 text-mist-300">por completar satisfactoriamente el curso</p>
          <p className="mt-2 text-xl font-medium text-white sm:text-2xl">{cert.course_title}</p>
        </div>
        <div className="relative mt-12 flex flex-col gap-6 border-t border-white/[0.08] pt-8 sm:flex-row sm:items-end sm:justify-between">
          <dl className="space-y-1.5 text-sm">
            <div><dt className="inline text-mist-400">Fecha de finalización: </dt><dd className="inline text-white">{formatDate(cert.completed_at)}</dd></div>
            {cert.instructor_name && <div><dt className="inline text-mist-400">Impartido por: </dt><dd className="inline text-white">{cert.instructor_name}</dd></div>}
            <div><dt className="inline text-mist-400">ID: </dt><dd className="inline font-mono text-white">{cert.code}</dd></div>
          </dl>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`Código QR para verificar el certificado ${cert.code}`} width={112} height={112} className="mx-auto rounded-lg" />
            <p className="mt-2 text-[11px] text-mist-400">Escanea para verificar</p>
          </div>
        </div>
      </article>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`/api/certificates/${cert.code}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-electric-500 to-violet-600 px-5 text-sm font-medium text-white"><Download className="size-4" /> Descargar PDF</a>
        <CopyLink url={url} />
        {!revoked && (
          <a href={linkedInShareUrl(url)} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06]">
            <Share2 className="size-4" aria-hidden /> Compartir en LinkedIn<span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        )}
        {cert.course_slug && <Link href={`/cursos/${cert.course_slug}`} className="inline-flex h-11 items-center rounded-xl px-4 text-sm text-mist-300 hover:bg-white/[0.06] hover:text-white">Ver el curso</Link>}
      </div>
    </div>
  );
}

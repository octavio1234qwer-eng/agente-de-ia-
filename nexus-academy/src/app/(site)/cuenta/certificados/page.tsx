import type { Metadata } from "next";
import Link from "next/link";
import { Award, BadgePlus, Download, ExternalLink, Share2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { siteUrl } from "@/lib/env";
import { linkedInAddToProfileUrl, linkedInShareUrl } from "@/lib/certificates/linkedin";

export const metadata: Metadata = { title: "Mis certificados" };

export default async function CertificatesPage() {
  const user = await requireUser("/cuenta/certificados");
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select("*").eq("user_id", user.id).is("revoked_at", null).order("issued_at", { ascending: false });
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Award className="size-6" />}
        title="Aún no tienes certificados"
        description="Completa todas las lecciones y aprueba las evaluaciones de un curso para obtener tu certificado verificable."
        action={<LinkButton href="/cuenta/cursos">Ir a mis cursos</LinkButton>}
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.map((c) => (
        <article key={c.id} className="glass glow-border relative overflow-hidden rounded-2xl p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-violet-600/20 blur-2xl" />
          <Award className="size-7 text-violet-300" aria-hidden />
          <h2 className="mt-4 font-semibold text-white">{c.course_title}</h2>
          <p className="mt-1 text-sm text-mist-400">Completado el {formatDate(c.completed_at)}</p>
          <p className="mt-3 font-mono text-xs text-mist-300">{c.code}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/certificados/${c.code}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1]"><ExternalLink className="size-4" aria-hidden /> Ver</Link>
            <a href={`/api/certificates/${c.code}/pdf`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm text-white hover:bg-white/[0.1]"><Download className="size-4" aria-hidden /> PDF</a>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={linkedInAddToProfileUrl({ courseTitle: c.course_title, issuedAt: c.issued_at, certUrl: `${siteUrl}/certificados/${c.code}` })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0a66c2] px-4 text-sm font-medium text-white hover:bg-[#0958a8]"
            >
              <BadgePlus className="size-4" aria-hidden /> Agregar a LinkedIn<span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
            <a
              href={linkedInShareUrl(`${siteUrl}/certificados/${c.code}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06]"
            >
              <Share2 className="size-4" aria-hidden /> Compartir<span className="sr-only"> en LinkedIn (se abre en otra pestaña)</span>
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

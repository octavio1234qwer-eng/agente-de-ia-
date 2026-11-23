import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getClassroom } from "@/lib/data/classroom";
import { Logo } from "@/components/layout/logo";
import { ProgressRing } from "@/components/ui/progress";

export default async function ClassroomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/aprender/${slug}`);
  const data = await getClassroom(slug, user.id);
  if (!data) notFound();
  const total = data.flat.length;
  const done = data.flat.filter((l) => l.completed).length;
  const percent = total ? Math.floor((done / total) * 100) : 0;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link href={`/cursos/${slug}`} className="grid size-10 place-items-center rounded-xl text-mist-300 hover:bg-white/[0.06] hover:text-white" aria-label="Volver al curso">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="hidden sm:block"><Logo /></div>
          <span className="hidden h-6 w-px bg-white/10 sm:block" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{data.course.title}</p>
          {data.hasAccess && (
            <div className="flex items-center gap-2" title={`${done} de ${total} lecciones`}>
              <span className="hidden text-xs text-mist-400 sm:inline">{done}/{total}</span>
              <ProgressRing value={percent} size={38} stroke={4} label={`${percent}%`} />
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

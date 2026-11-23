import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";

export const metadata: Metadata = { title: "Instructores" };

export default async function InstructorsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("instructors")
    .select("*, courses(slug, title, status)")
    .eq("is_active", true)
    .order("name");
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Instructores</h1>
      <p className="mt-3 max-w-2xl text-mist-300">Los equipos que diseñan los programas de NEXUS ACADEMY.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {(data ?? []).map((i) => {
          const courses = (i.courses ?? []).filter((c) => c.status === "published");
          return (
            <article key={i.id} id={i.slug} className="glass scroll-mt-24 rounded-3xl p-7">
              <div className="flex items-center gap-4">
                <Avatar name={i.name} url={i.avatar_url} size={64} />
                <div>
                  <h2 className="text-lg font-semibold text-white">{i.name}</h2>
                  {i.headline && <p className="text-sm text-electric-300">{i.headline}</p>}
                </div>
              </div>
              {i.bio && <p className="mt-4 text-sm leading-relaxed text-mist-300">{i.bio}</p>}
              {courses.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {courses.map((c) => (
                    <li key={c.slug}><Link href={`/cursos/${c.slug}`} className="inline-block rounded-full border border-white/10 px-3 py-1.5 text-xs text-mist-200 hover:border-electric-400/50 hover:text-white">{c.title}</Link></li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

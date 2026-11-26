import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Panel, Table, Td } from "@/components/admin/ui";
import { parseFunnel, pct, topDropOffs } from "@/lib/funnel";
import { lessonTypeLabel } from "@/lib/utils";

export const metadata: Metadata = { title: "Embudo del curso" };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("es-MX")} ${n === 1 ? one : many}`;

export default async function CourseFunnelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, title").eq("id", id).maybeSingle();
  if (!course) notFound();
  const { data, error } = await supabase.rpc("admin_course_funnel", { p_course_id: id });
  const funnel = error ? null : parseFunnel(data);

  return (
    <>
      <AdminHeader
        title={`Embudo · ${course.title}`}
        description="En qué lección se detienen los alumnos, con su progreso real. Solo cuenta alumnos con acceso vigente."
        actions={<Link href={`/admin/cursos/${id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-mist-200 hover:bg-white/[0.06]"><ArrowLeft className="size-4" aria-hidden /> Volver al curso</Link>}
      />
      {!funnel ? (
        <p role="alert" className="text-red-300">No se pudo cargar el embudo.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="funnel-summary">
            {[
              ["Inscritos", funnel.enrolled.toLocaleString("es-MX")],
              ["Empezaron", `${funnel.started.toLocaleString("es-MX")} (${pct(funnel.started, funnel.enrolled)} %)`],
              ["Sin empezar", funnel.not_started.toLocaleString("es-MX")],
              ["Terminaron", funnel.completed.toLocaleString("es-MX")],
              ["Tasa de finalización", `${funnel.completion_rate.toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`],
            ].map(([k, v]) => (
              <div key={k} className="glass rounded-2xl px-4 py-3">
                <dt className="text-xs text-mist-400">{k}</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>

          {funnel.enrolled === 0 ? (
            <p className="mt-6 text-sm text-mist-400">Aún no hay alumnos inscritos en este curso.</p>
          ) : (
            <Panel className="mt-4" title="Dónde se detienen" subtitle="Alumnos que empezaron, no han terminado y cuya primera lección pendiente es esta">
              {topDropOffs(funnel).length ? (
                <ol className="space-y-2 text-sm" data-testid="top-dropoffs">
                  {topDropOffs(funnel).map((l) => (
                    <li key={l.lesson_id} className="text-mist-200">
                      <span className="text-white">Lección {l.idx}: {l.title}</span> <span className="text-mist-400">({l.module_title})</span> — {plural(l.stuck, "alumno detenido", "alumnos detenidos")}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-mist-400">Nadie está detenido: quien empezó, terminó el curso.</p>
              )}
            </Panel>
          )}

          <div className="mt-4">
            <Table label="Embudo por lección" head={["#", "Lección", "Tipo", `Completaron (de ${funnel.started} que empezaron)`, "Detenidos aquí"]} empty={funnel.lessons.length ? undefined : "El curso aún no tiene lecciones."}>
              {funnel.lessons.map((l) => {
                const p = pct(l.completed, funnel.started);
                return (
                  <tr key={l.lesson_id} data-testid="funnel-row">
                    <Td className="text-mist-400">{l.idx}</Td>
                    <Td><span className="text-white">{l.title}</span><span className="block text-xs text-mist-400">{l.module_title}</span></Td>
                    <Td>{lessonTypeLabel[l.type] ?? l.type}</Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-32 shrink-0 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden><span className="block h-full rounded-full bg-electric-500" style={{ width: `${p}%` }} /></span>
                        <span>{l.completed.toLocaleString("es-MX")} · {p} %</span>
                      </div>
                    </Td>
                    <Td className={l.stuck > 0 ? "font-semibold text-amber-300" : "text-mist-400"}>{l.stuck.toLocaleString("es-MX")}</Td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </>
      )}
    </>
  );
}

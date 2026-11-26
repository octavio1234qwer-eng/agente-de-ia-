import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminHeader, Table, Td } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteQaPostAction, moderateQaAction } from "@/lib/actions/qa";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Preguntas" };

const filters = [
  { key: "unanswered", label: "Sin responder" },
  { key: "all", label: "Todas" },
  { key: "hidden", label: "Ocultas" },
] as const;
type Filter = (typeof filters)[number]["key"];

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requireAdmin();
  const { filtro } = await searchParams;
  const filter: Filter = filters.some((f) => f.key === filtro) ? (filtro as Filter) : "unanswered";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_lesson_questions", { p_filter: filter, p_limit: 200 });
  const rows = data ?? [];
  const empty = error
    ? "No se pudieron cargar las preguntas."
    : rows.length
      ? undefined
      : filter === "unanswered" ? "No hay preguntas pendientes. 🎉" : filter === "hidden" ? "No hay preguntas ocultas." : "Aún no hay preguntas.";

  return (
    <>
      <AdminHeader
        title="Preguntas de alumnos"
        description="Lo que preguntan los alumnos en cada lección. Responde desde el aula: el alumno recibe un aviso por correo y tu respuesta se marca como del equipo."
      />
      <nav aria-label="Filtrar preguntas" className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === "unanswered" ? "/admin/preguntas" : `/admin/preguntas?filtro=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-xl px-3.5 text-sm", filter === f.key ? "bg-electric-500/15 text-white ring-1 ring-electric-400/30" : "text-mist-300 hover:bg-white/[0.04] hover:text-white")}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <Table label="Preguntas de alumnos" head={["Curso y lección", "Alumno", "Pregunta", "Estado", ""]} empty={empty}>
        {rows.map((q) => (
          <tr key={q.id}>
            <Td className="max-w-56 text-xs">
              <span className="block font-medium text-mist-100">{q.course_title}</span>
              <span className="text-mist-400">{q.lesson_title}</span>
            </Td>
            <Td className="text-xs">
              {q.author_name || "Sin nombre"}
              <span className="block text-mist-400">{q.author_email}</span>
              <span className="block text-mist-500">{formatDate(q.created_at, { dateStyle: "medium", timeStyle: "short" })}</span>
            </Td>
            <Td className="max-w-md whitespace-pre-wrap break-words text-xs text-mist-200">{q.body.length > 400 ? `${q.body.slice(0, 399)}…` : q.body}</Td>
            <Td className="whitespace-nowrap">
              {q.hidden ? <Badge tone="neutral">Oculta</Badge> : q.answered ? <Badge tone="green">Respondida</Badge> : <Badge tone="amber">Sin responder</Badge>}
              <span className="mt-1 block text-xs text-mist-400">{q.answers === 1 ? "1 respuesta" : `${q.answers} respuestas`}</span>
            </Td>
            <Td className="whitespace-nowrap">
              <Link href={`/aprender/${q.course_slug}/${q.lesson_id}#pregunta-${q.id}`} className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-xs text-electric-300 hover:bg-white/[0.06] hover:text-white">
                {q.answered || q.hidden ? "Ver en el aula" : "Responder en el aula"}
              </Link>
              <form action={moderateQaAction} className="inline">
                <input type="hidden" name="kind" value="question" />
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="hidden" value={q.hidden ? "0" : "1"} />
                <ConfirmButton danger={false} message={q.hidden ? "¿Volver a mostrar esta pregunta?" : "¿Ocultar esta pregunta a los alumnos?"}>{q.hidden ? "Mostrar" : "Ocultar"}</ConfirmButton>
              </form>
              <form action={deleteQaPostAction} className="inline">
                <input type="hidden" name="kind" value="question" />
                <input type="hidden" name="id" value={q.id} />
                <ConfirmButton message="¿Eliminar esta pregunta y sus respuestas?">Eliminar</ConfirmButton>
              </form>
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}

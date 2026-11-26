"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { CheckCircle2, EyeOff, LoaderCircle, MessageCircleQuestion, Pencil, Reply, ShieldCheck } from "lucide-react";
import { answerQuestionAction, askQuestionAction, deleteQaPostAction, editQaPostAction, moderateQaAction } from "@/lib/actions/qa";
import type { ActionState } from "@/lib/actions/types";
import { ANSWER_MAX, QUESTION_MAX, QUESTION_MIN, type QaAnswer, type QaQuestion } from "@/lib/qa";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

type Kind = "question" | "answer";

const textareaClass =
  "block w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-mist-500 focus:border-electric-400/60 focus:outline-none";
const primaryButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-electric-500 to-violet-500 px-4 text-sm font-medium text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";
const ghostButton = "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-mist-200 hover:bg-white/[0.06] hover:text-white";

/** Formulario con texto controlado que se vacía cuando el servidor confirma. */
function useComposer(action: (prev: ActionState, fd: FormData) => Promise<ActionState>, initial = "") {
  const [state, formAction, pending] = useActionState(action, null);
  const [value, setValue] = useState(initial);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.success) setValue(state.values?.body ?? "");
  }
  return { state, formAction, pending, value, setValue };
}

function Status({ id, state, pending }: { id: string; state: ActionState; pending: boolean }) {
  return (
    <p id={id} role="status" className="min-h-5 text-xs">
      {pending ? (
        <span className="inline-flex items-center gap-1 text-mist-300"><LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Enviando…</span>
      ) : state?.error ? (
        <span className="text-red-300">{state.error}</span>
      ) : state?.success ? (
        <span className="text-emerald-300">{state.success}</span>
      ) : null}
    </p>
  );
}

function AskForm({ lessonId }: { lessonId: string }) {
  const { state, formAction, pending, value, setValue } = useComposer(askQuestionAction);
  const tooLong = value.length > QUESTION_MAX;
  return (
    <form action={formAction} className="mt-4 space-y-2">
      <input type="hidden" name="lesson_id" value={lessonId} />
      <label htmlFor="qa-ask" className="text-sm font-medium text-mist-100">Haz una pregunta sobre esta lección</label>
      <textarea
        id="qa-ask"
        name="body"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby="qa-ask-help qa-ask-status"
        placeholder="¿Qué parte no quedó clara? Entre más concreta, mejor la respuesta."
        className={textareaClass}
      />
      <p id="qa-ask-help" className="text-xs text-mist-400">
        La verán los alumnos de este curso con tu nombre y la inicial de tu apellido. Te avisamos por correo cuando el equipo responda.
        <span className={cn("ml-1 tabular-nums", tooLong && "text-red-300")}>{value.length}/{QUESTION_MAX}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || value.trim().length < QUESTION_MIN || tooLong} className={primaryButton}>
          Publicar pregunta
        </button>
        <Status id="qa-ask-status" state={state} pending={pending} />
      </div>
    </form>
  );
}

function EditForm({ kind, id, initial, onDone }: { kind: Kind; id: string; initial: string; onDone: () => void }) {
  const { state, formAction, pending, value, setValue } = useComposer(editQaPostAction, initial);
  const uid = useId();
  const max = kind === "question" ? QUESTION_MAX : ANSWER_MAX;
  const min = kind === "question" ? QUESTION_MIN : 1;
  useEffect(() => {
    if (state?.success) onDone();
  }, [state, onDone]);
  return (
    <form action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`${uid}-edit`} className="sr-only">{kind === "question" ? "Editar pregunta" : "Editar respuesta"}</label>
      <textarea id={`${uid}-edit`} name="body" rows={3} value={value} onChange={(e) => setValue(e.target.value)} aria-describedby={`${uid}-status`} className={textareaClass} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || value.trim().length < min || value.length > max} className={primaryButton}>Guardar cambios</button>
        <button type="button" onClick={onDone} className={ghostButton}>Cancelar</button>
        <Status id={`${uid}-status`} state={state} pending={pending} />
      </div>
    </form>
  );
}

function ReplyForm({ questionId, onDone }: { questionId: string; onDone: () => void }) {
  const { state, formAction, pending, value, setValue } = useComposer(answerQuestionAction);
  const uid = useId();
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="question_id" value={questionId} />
      <label htmlFor={`${uid}-reply`} className="text-xs font-medium text-mist-200">Tu respuesta</label>
      <textarea id={`${uid}-reply`} name="body" rows={3} value={value} onChange={(e) => setValue(e.target.value)} aria-describedby={`${uid}-status`} className={textareaClass} autoFocus />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending || !value.trim() || value.length > ANSWER_MAX} className={primaryButton}>Publicar respuesta</button>
        <button type="button" onClick={onDone} className={ghostButton}>Cerrar</button>
        <Status id={`${uid}-status`} state={state} pending={pending} />
      </div>
    </form>
  );
}

function PostTools({ kind, id, mine, hidden, isAdmin, onEdit }: { kind: Kind; id: string; mine: boolean; hidden: boolean; isAdmin: boolean; onEdit: () => void }) {
  const noun = kind === "question" ? "pregunta" : "respuesta";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {mine && !hidden && (
        <button type="button" onClick={onEdit} className={ghostButton}><Pencil className="size-3.5" aria-hidden /> Editar</button>
      )}
      {isAdmin && (
        <form action={moderateQaAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="hidden" value={hidden ? "0" : "1"} />
          <ConfirmButton danger={false} message={hidden ? `¿Volver a mostrar esta ${noun}?` : `¿Ocultar esta ${noun} a los alumnos?`}>
            <EyeOff className="size-3.5" aria-hidden /> {hidden ? "Mostrar" : "Ocultar"}
          </ConfirmButton>
        </form>
      )}
      {(mine || isAdmin) && (
        <form action={deleteQaPostAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <ConfirmButton message={kind === "question" ? "¿Eliminar esta pregunta y sus respuestas?" : "¿Eliminar esta respuesta?"}>Eliminar</ConfirmButton>
        </form>
      )}
    </div>
  );
}

function Byline({ author, mine, staff, createdAt, edited }: { author: string; mine: boolean; staff: boolean; createdAt: string; edited: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mist-400">
      <span className="font-medium text-mist-100">{author}{mine && " (tú)"}</span>
      {staff && <Badge tone="violet"><ShieldCheck className="size-3" aria-hidden /> Equipo</Badge>}
      <time dateTime={createdAt}>{formatDate(createdAt, { dateStyle: "medium", timeStyle: "short" })}</time>
      {edited && <span>· editado</span>}
    </p>
  );
}

function HiddenNote({ isAdmin }: { isAdmin: boolean }) {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
      <EyeOff className="size-3.5" aria-hidden /> {isAdmin ? "Oculta: los alumnos no la ven." : "Oculta por moderación: solo tú y el equipo la ven."}
    </p>
  );
}

function AnswerItem({ a, isAdmin }: { a: QaAnswer; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className={cn("rounded-xl border p-3", a.is_staff ? "border-violet-400/25 bg-violet-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Byline author={a.author} mine={a.is_mine} staff={a.is_staff} createdAt={a.created_at} edited={a.edited} />
        <PostTools kind="answer" id={a.id} mine={a.is_mine} hidden={a.hidden} isAdmin={isAdmin} onEdit={() => setEditing(true)} />
      </div>
      {editing ? (
        <EditForm kind="answer" id={a.id} initial={a.body} onDone={() => setEditing(false)} />
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-mist-100">{a.body}</p>
      )}
      {a.hidden && <HiddenNote isAdmin={isAdmin} />}
    </li>
  );
}

function QuestionItem({ q, isAdmin, canPost }: { q: QaQuestion; isAdmin: boolean; canPost: boolean }) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  return (
    <li>
      <article id={`pregunta-${q.id}`} aria-label={`Pregunta de ${q.author}`} className="scroll-mt-24 rounded-2xl border border-white/[0.06] bg-ink-850/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <Byline author={q.author} mine={q.is_mine} staff={q.author_is_staff} createdAt={q.created_at} edited={q.edited} />
            {q.answered && <Badge tone="green"><CheckCircle2 className="size-3" aria-hidden /> Respondida por el equipo</Badge>}
          </div>
          <PostTools kind="question" id={q.id} mine={q.is_mine} hidden={q.hidden} isAdmin={isAdmin} onEdit={() => setEditing(true)} />
        </div>
        {editing ? (
          <EditForm kind="question" id={q.id} initial={q.body} onDone={() => setEditing(false)} />
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white">{q.body}</p>
        )}
        {q.hidden && <HiddenNote isAdmin={isAdmin} />}

        {q.answers.length > 0 && (
          <ul aria-label={`Respuestas a la pregunta de ${q.author}`} className="mt-3 space-y-2 border-l border-white/[0.08] pl-3 sm:pl-4">
            {q.answers.map((a) => <AnswerItem key={a.id} a={a} isAdmin={isAdmin} />)}
          </ul>
        )}

        {canPost && !q.hidden && (
          replying ? (
            <ReplyForm questionId={q.id} onDone={() => setReplying(false)} />
          ) : (
            <button type="button" onClick={() => setReplying(true)} className={cn(ghostButton, "mt-2")}>
              <Reply className="size-3.5" aria-hidden /> Responder
            </button>
          )
        )}
      </article>
    </li>
  );
}

/**
 * Preguntas y respuestas de la lección: los alumnos inscritos preguntan y se
 * ayudan entre sí; las respuestas del equipo (admin o instructor) se destacan.
 */
export function LessonQA({ lessonId, questions, isAdmin, canPost }: { lessonId: string; questions: QaQuestion[]; isAdmin: boolean; canPost: boolean }) {
  const answered = questions.filter((q) => q.answered).length;
  return (
    <section id="preguntas" className="glass scroll-mt-24 rounded-2xl p-5" aria-labelledby="preguntas-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="preguntas-titulo" className="inline-flex items-center gap-2 font-semibold text-white">
          <MessageCircleQuestion className="size-5 text-electric-300" aria-hidden /> Preguntas de la lección
          <span className="text-sm font-normal text-mist-400">({questions.length})</span>
        </h2>
        {questions.length > 0 && <p className="text-xs text-mist-400">{answered} de {questions.length} con respuesta del equipo</p>}
      </div>
      {canPost && <AskForm lessonId={lessonId} />}
      {questions.length === 0 ? (
        <p className="mt-4 text-sm text-mist-400">Aún no hay preguntas en esta lección. ¿Algo no quedó claro? Pregunta y el equipo te responde.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {questions.map((q) => <QuestionItem key={q.id} q={q} isAdmin={isAdmin} canPost={canPost} />)}
        </ul>
      )}
    </section>
  );
}

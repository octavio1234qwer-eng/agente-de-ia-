"use client";
import { useActionState, useState } from "react";
import { bulkEnrollAction } from "@/lib/actions/bulk-enroll";
import { BULK_MAX, parseEmailList, statusLabel, type BulkStatus } from "@/lib/bulk-enroll";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";

const tone: Record<BulkStatus, "green" | "blue" | "neutral" | "amber" | "red"> = {
  enrolled: "green",
  restored: "green",
  invited: "blue",
  already: "neutral",
  not_found: "amber",
  invalid: "red",
  invite_failed: "red",
};

export function BulkEnrollForm({ courseId, canInvite }: { courseId: string; canInvite: boolean }) {
  const [state, formAction] = useActionState(bulkEnrollAction, null);
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    setText(state?.values?.emails ?? "");
  }
  const count = parseEmailList(text).length;

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="course_id" value={courseId} />
        <div>
          <label htmlFor="bulk-emails" className="text-sm font-medium text-mist-100">Correos de los alumnos</label>
          <textarea
            id="bulk-emails"
            name="emails"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="bulk-emails-help"
            placeholder={"ana@empresa.com\nbeto@empresa.com, carla@empresa.com"}
            className="mt-1.5 block w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-mono text-sm text-white placeholder:text-mist-500 focus:border-electric-400/60 focus:outline-none"
          />
          <p id="bulk-emails-help" className="mt-1 text-xs text-mist-400">
            Uno por línea o separados por comas (también sirve pegar una columna de Excel). Se quitan repetidos. {count > 0 && <span className={count > BULK_MAX ? "text-red-300" : "text-mist-200"}>{count} correo(s) detectados, máximo {BULK_MAX}.</span>}
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] p-3 text-sm text-mist-200">
          <input type="checkbox" name="invite" value="1" defaultChecked={canInvite} disabled={!canInvite} className="mt-0.5 size-4 accent-electric-500" />
          <span>
            Invitar por correo a quien aún no tiene cuenta
            <span className="block text-xs text-mist-400">
              {canInvite
                ? "Reciben un enlace para crear su contraseña y ya quedan inscritos. El correo lo envía Supabase Auth (configura su SMTP en producción)."
                : "Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor."}
            </span>
          </span>
        </label>
        {state?.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
        <SubmitButton pendingLabel="Inscribiendo…" disabled={count === 0 || count > BULK_MAX}>Dar acceso al curso</SubmitButton>
      </form>

      {state?.rows && (
        <section aria-labelledby="bulk-result" className="space-y-3">
          <h2 id="bulk-result" className="font-semibold text-white">Resultado</h2>
          <p role="status" className="text-sm text-emerald-200">{state.summary}</p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" tabIndex={0} role="region" aria-label="Resultado por correo">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-mist-400">
                <tr><th scope="col" className="px-4 py-2.5 font-medium">Correo</th><th scope="col" className="px-4 py-2.5 font-medium">Resultado</th></tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-mist-200">
                {state.rows.map((r) => (
                  <tr key={r.email}>
                    <td className="break-all px-4 py-2 font-mono text-xs">{r.email}</td>
                    <td className="px-4 py-2">
                      <Badge tone={tone[r.status]}>{statusLabel[r.status]}</Badge>
                      {r.detail && <span className="mt-1 block text-xs text-mist-400">{r.detail}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

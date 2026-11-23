import type { Metadata } from "next";
import Link from "next/link";
import { Bot, MessageSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NexusChat } from "@/components/classroom/nexus-chat";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "NEXUS AI" };

export default async function NexusAiPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser("/nexus-ai");
  const { c } = await searchParams;
  const supabase = await createClient();
  const { data: conversations } = await supabase.from("ai_conversations").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30);
  const active = c && conversations?.some((x) => x.id === c) ? c : null;
  const { data: messages } = active
    ? await supabase.from("ai_messages").select("role, content").eq("conversation_id", active).order("created_at")
    : { data: [] };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-electric-500 to-violet-600"><Bot className="size-5 text-white" /></span>
        <div>
          <h1 className="text-2xl font-semibold text-white">NEXUS AI</h1>
          <p className="text-sm text-mist-400">Explicaciones, resúmenes, práctica y tu ruta de aprendizaje con cursos reales del catálogo.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="glass h-fit rounded-2xl p-3">
          <Link href="/nexus-ai" className="flex h-10 items-center justify-center rounded-xl bg-white/[0.06] text-sm text-white hover:bg-white/[0.1]">Nueva conversación</Link>
          <ul className="mt-3 max-h-[60dvh] space-y-1 overflow-y-auto">
            {(conversations ?? []).map((x) => (
              <li key={x.id}>
                <Link href={`/nexus-ai?c=${x.id}`} aria-current={x.id === active ? "page" : undefined} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${x.id === active ? "bg-white/[0.07] text-white" : "text-mist-300 hover:bg-white/[0.04]"}`}>
                  <MessageSquare className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0"><span className="block truncate">{x.title}</span><span className="text-[11px] text-mist-500">{formatDate(x.updated_at, { dateStyle: "medium" })}</span></span>
                </Link>
              </li>
            ))}
            {(conversations ?? []).length === 0 && <li className="px-3 py-2 text-xs text-mist-500">Aún no tienes conversaciones.</li>}
          </ul>
        </aside>
        <NexusChat key={active ?? "new"} variant="page" initialConversationId={active} initialMessages={(messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))} />
      </div>
    </div>
  );
}

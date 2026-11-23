import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NoteRow = {
  lesson_id: string;
  body: string;
  updated_at: string;
  lesson: { id: string; title: string; type: "video" | "article" | "quiz" | "exercise"; position: number; module: { title: string; position: number } | null } | null;
  course: { id: string; slug: string; title: string } | null;
};

/** Notas del alumno (RLS: solo las propias), de la más reciente a la más antigua. */
export async function getMyNotes(userId: string): Promise<NoteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_notes")
    .select("lesson_id, body, updated_at, lesson:lessons(id, title, type, position, module:modules(title, position)), course:courses(id, slug, title)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as NoteRow[];
}

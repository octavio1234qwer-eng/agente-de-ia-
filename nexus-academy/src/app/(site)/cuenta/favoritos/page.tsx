import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COURSE_CARD_SELECT, type CourseCard as CourseCardData } from "@/lib/data/catalog";
import { CourseCard } from "@/components/course/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage() {
  const user = await requireUser("/cuenta/favoritos");
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select(`created_at, course:courses(${COURSE_CARD_SELECT})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const courses = (data ?? []).map((f) => f.course as unknown as CourseCardData | null).filter((c): c is CourseCardData => Boolean(c));
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-6" />}
        title="No tienes favoritos"
        description="Guarda cursos con el botón de corazón para encontrarlos rápido después."
        action={<LinkButton href="/cursos">Explorar cursos</LinkButton>}
      />
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c) => <CourseCard key={c.id} course={c} />)}
    </div>
  );
}

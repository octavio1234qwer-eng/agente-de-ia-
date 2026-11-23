import { CourseCardSkeleton } from "@/components/course/course-card";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando cursos">
      <div className="skeleton h-12 w-80 rounded-xl" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="skeleton hidden h-96 rounded-2xl lg:block" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CourseCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

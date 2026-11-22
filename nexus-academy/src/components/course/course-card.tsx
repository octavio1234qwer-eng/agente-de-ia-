import Link from "next/link";
import { Clock, BookOpen, Users } from "lucide-react";
import type { CourseCard as CourseCardData } from "@/lib/data/catalog";
import { formatDuration, levelLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { CourseCover } from "./course-cover";
import { PriceTag } from "./price-tag";
import { Rating } from "./rating";

export function CourseCard({ course, progress, priority }: { course: CourseCardData; progress?: number | null; priority?: boolean }) {
  return (
    <Link
      href={`/cursos/${course.slug}`}
      className="group glass glow-border flex h-full flex-col overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgb(59_116_255_/_0.45)]"
    >
      <div className="relative">
        <CourseCover
          title={course.title}
          slug={course.slug}
          coverUrl={course.cover_url}
          color={course.category?.color}
          icon={course.category?.icon}
          className="aspect-[16/9] transition duration-500 group-hover:scale-[1.03]"
          priority={priority}
        />
        <div className="absolute right-3 top-3 flex gap-1.5">
          {course.price_cents === 0 && <Badge tone="green" className="backdrop-blur-md">Gratis</Badge>}
          {course.is_featured && course.price_cents > 0 && <Badge tone="violet" className="backdrop-blur-md">Destacado</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-mist-400">
          {course.category && <span style={{ color: course.category.color }} className="font-medium">{course.category.name}</span>}
          <span aria-hidden>·</span>
          <span>{levelLabel[course.level]}</span>
        </div>
        <h3 className="text-[17px] font-semibold leading-snug text-white transition group-hover:text-electric-300">{course.title}</h3>
        {course.subtitle && <p className="mt-1.5 line-clamp-2 text-sm text-mist-300">{course.subtitle}</p>}
        {course.instructor && <p className="mt-3 text-xs text-mist-400">{course.instructor.name}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist-400">
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatDuration(course.duration_minutes)}</span>
          <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" aria-hidden />{course.lessons_count} lecciones</span>
          {course.students_count > 0 && (
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{course.students_count.toLocaleString("es-MX")}</span>
          )}
        </div>
        <div className="mt-2"><Rating value={Number(course.rating_avg)} count={course.rating_count} /></div>
        <div className="mt-auto pt-4">
          {typeof progress === "number" ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span className="text-mist-300">Tu progreso</span><span className="font-semibold text-white">{progress}%</span></div>
              <ProgressBar value={progress} />
            </div>
          ) : (
            <PriceTag price={course.price_cents} compareAt={course.compare_at_price_cents} currency={course.currency} />
          )}
        </div>
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="skeleton aspect-[16/9]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-5 w-4/5 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
    </div>
  );
}

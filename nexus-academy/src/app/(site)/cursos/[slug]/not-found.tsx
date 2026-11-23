import { LinkButton } from "@/components/ui/button";

export default function CourseNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold text-white">Curso no encontrado</h1>
      <p className="mt-3 text-mist-300">Es posible que el curso haya cambiado de dirección o ya no esté disponible.</p>
      <LinkButton href="/cursos" className="mt-8">Ver el catálogo</LinkButton>
    </div>
  );
}

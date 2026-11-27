import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-semibold text-white">404</p>
      <p className="text-slate-400">La página no existe o no tienes acceso.</p>
      <ButtonLink href="/">Volver al dashboard</ButtonLink>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { SignUpForm } from "@/components/auth/auth-forms";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next, "/cuenta/cursos");
  if (await getCurrentUser()) redirect(nextPath);
  return (
    <AuthCard
      title="Crea tu cuenta"
      subtitle="Gratis. Accede a cursos sin costo, NEXUS AI y tu progreso en cualquier dispositivo."
      footer={<>¿Ya tienes cuenta? <Link href={`/login${next ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-medium text-electric-300 hover:text-white">Inicia sesión</Link></>}
    >
      <SignUpForm next={nextPath} />
    </AuthCard>
  );
}

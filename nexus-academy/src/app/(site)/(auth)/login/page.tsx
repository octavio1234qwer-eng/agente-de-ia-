import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { LoginForm } from "@/components/auth/auth-forms";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const nextPath = safeNextPath(next, "/cuenta/cursos");
  if (await getCurrentUser()) redirect(nextPath);
  return (
    <AuthCard
      title="Bienvenido de vuelta"
      subtitle="Inicia sesión para continuar aprendiendo."
      footer={<>¿No tienes cuenta? <Link href={`/registro${next ? `?next=${encodeURIComponent(nextPath)}` : ""}`} className="font-medium text-electric-300 hover:text-white">Crear cuenta gratis</Link></>}
    >
      {error === "link" && (
        <p role="alert" className="mb-5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          El enlace expiró o ya se usó. Solicita uno nuevo.
        </p>
      )}
      <LoginForm next={nextPath} />
    </AuthCard>
  );
}

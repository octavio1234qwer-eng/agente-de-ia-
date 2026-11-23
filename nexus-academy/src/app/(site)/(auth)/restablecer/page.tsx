import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { NewPasswordForm } from "@/components/auth/auth-forms";
import { AuthCard } from "../auth-card";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <AuthCard title="Enlace no válido" subtitle="El enlace para restablecer tu contraseña expiró o ya se utilizó.">
        <LinkButton href="/recuperar" className="w-full">Solicitar un enlace nuevo</LinkButton>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Crea una nueva contraseña"
      subtitle={`Para la cuenta ${user.email}`}
      footer={<Link href="/cuenta/cursos" className="font-medium text-electric-300 hover:text-white">Ir a mis cursos</Link>}
    >
      <NewPasswordForm />
    </AuthCard>
  );
}

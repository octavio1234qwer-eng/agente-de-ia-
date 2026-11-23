import type { Metadata } from "next";
import Link from "next/link";
import { RecoverForm } from "@/components/auth/auth-forms";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RecoverPage() {
  return (
    <AuthCard
      title="Recupera tu contraseña"
      subtitle="Escribe tu correo y te enviaremos un enlace seguro para crear una nueva contraseña."
      footer={<Link href="/login" className="font-medium text-electric-300 hover:text-white">Volver a iniciar sesión</Link>}
    >
      <RecoverForm />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/shell/auth-frame";
import { getCurrentUser } from "@/server/auth/dal";
import { countUsers } from "@/server/auth/service";
import { withServiceContext } from "@/server/db/context";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const users = await withServiceContext("panel", (db) => countUsers(db));
  if (users === 0) redirect("/setup");
  return (
    <AuthFrame title="Virtual Model Factory AI" subtitle="Acceso exclusivo para administradores autorizados.">
      <LoginForm />
    </AuthFrame>
  );
}

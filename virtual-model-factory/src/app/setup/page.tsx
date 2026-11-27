import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AuthFrame } from "@/components/shell/auth-frame";
import { Notice } from "@/components/ui";
import { getEnv } from "@/server/config/env";
import { countUsers } from "@/server/auth/service";
import { withServiceContext } from "@/server/db/context";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Configuración inicial" };

export default async function SetupPage() {
  await connection();
  const users = await withServiceContext("panel", (db) => countUsers(db));
  if (users > 0) redirect("/login");
  return (
    <AuthFrame title="Configuración inicial" subtitle="Crea la cuenta del propietario de la fábrica.">
      {getEnv().SETUP_TOKEN ? (
        <SetupForm />
      ) : (
        <Notice tone="warning">
          Define <code>SETUP_TOKEN</code> (24+ caracteres) en el entorno del servidor y recarga, o crea el propietario con{" "}
          <code>npm run admin:create</code>.
        </Notice>
      )}
    </AuthFrame>
  );
}

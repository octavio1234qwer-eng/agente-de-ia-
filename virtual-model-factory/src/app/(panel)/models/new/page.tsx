import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/dal";
import { createModelAction } from "../actions";
import { ModelForm } from "../model-form";

export const metadata: Metadata = { title: "Nuevo modelo" };

export default async function NewModelPage() {
  await requirePermission("models.create");
  return (
    <>
      <PageHeader title="Nuevo modelo virtual" description="Se crea como borrador. Podrás activarlo cuando cumpla los requisitos." />
      <ModelForm action={createModelAction} submitLabel="Crear modelo" />
    </>
  );
}

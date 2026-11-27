import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import type { ModelInput } from "@/lib/model-schema";
import { asCurrentUser, requirePermission } from "@/server/auth/dal";
import { getModel } from "@/server/modules/models/repository";
import { updateModelAction } from "../../actions";
import { ModelForm } from "../../model-form";

export const metadata: Metadata = { title: "Editar modelo" };

export default async function EditModelPage({ params }: PageProps<"/models/[id]/edit">) {
  await requirePermission("models.update");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await asCurrentUser((db) => getModel(db, id));
  if (!m) notFound();
  const initial: ModelInput = {
    slug: m.slug, stageName: m.stageName, bio: m.bio, fictionalAge: m.fictionalAge, aiDisclosure: m.aiDisclosure,
    contentRating: m.contentRating as ModelInput["contentRating"], targetAudience: m.targetAudience,
    commercialPositioning: m.commercialPositioning, languages: m.languages as ModelInput["languages"], timezone: m.timezone,
    visualIdentity: { primaryColor: m.primaryColor, secondaryColor: m.secondaryColor, aesthetic: m.aesthetic, styleNotes: m.styleNotes },
    personality: m.personality ?? {
      traits: [], tone: "", communicationStyle: "", backstory: "", interests: [], boundaries: [], samplePhrases: [],
      conversationHistoryLimit: 20, escalationKeywords: [],
    },
    likenessAttestation: m.likenessAttestation,
  };
  return (
    <>
      <PageHeader title={`Editar ${m.stageName}`} description="Si cambias la personalidad se guarda como una versión nueva." />
      <ModelForm action={updateModelAction.bind(null, m.id)} initial={initial} submitLabel="Guardar cambios" />
    </>
  );
}

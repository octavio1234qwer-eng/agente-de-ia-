import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/account/profile-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/cuenta");
  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-white">Perfil</h2>
      <p className="mt-1 text-sm text-mist-400">Tu información personal. Solo tu nombre de pila e inicial aparecen en reseñas públicas.</p>
      <div className="mt-8">
        <ProfileForm userId={user.id} fullName={user.full_name} headline={user.headline} bio={user.bio} avatarUrl={user.avatar_url} />
      </div>
    </Card>
  );
}

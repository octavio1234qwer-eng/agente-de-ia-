import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PreferencesForm } from "@/components/account/preferences-form";
import { NewPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  const user = await requireUser("/cuenta/ajustes");
  return (
    <div className="space-y-6">
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Correos</h2>
        <p className="mt-1 text-sm text-mist-400">Los correos de compra, acceso y seguridad siempre se envían.</p>
        <div className="mt-6"><PreferencesForm marketing={user.marketing_opt_in} reminders={user.reminder_opt_in} /></div>
      </Card>
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Cambiar contraseña</h2>
        <div className="mt-6 max-w-md"><NewPasswordForm requireCurrent /></div>
      </Card>
      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Tus datos</h2>
        <p className="mt-2 text-sm leading-relaxed text-mist-300">
          Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus datos personales (derechos ARCO) escribiendo al correo de contacto indicado en el <a className="text-electric-300 underline" href="/privacidad">aviso de privacidad</a>.
        </p>
      </Card>
    </div>
  );
}

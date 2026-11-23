import { ShieldAlert } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function CertificateNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <ShieldAlert className="mx-auto size-10 text-amber-300" />
      <h1 className="mt-4 text-3xl font-semibold text-white">Certificado no encontrado</h1>
      <p className="mt-3 text-mist-300">No existe ningún certificado con ese identificador. Revisa que el código esté completo (formato NX-XXXXX-XXXXX).</p>
      <LinkButton href="/verificar" className="mt-8">Verificar otro código</LinkButton>
    </div>
  );
}

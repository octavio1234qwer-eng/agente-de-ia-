import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { CERT_CODE } from "@/lib/data/certificates";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verificar certificado" };

async function verify(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  redirect(`/verificar?code=${encodeURIComponent(code)}`);
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const normalized = (code ?? "").trim().toUpperCase();
  if (normalized && CERT_CODE.test(normalized)) redirect(`/certificados/${normalized}`);
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <div className="glass-strong glow-border rounded-3xl p-8 text-center">
        <BadgeCheck className="mx-auto size-10 text-electric-300" />
        <h1 className="mt-4 text-2xl font-semibold text-white">Verificar un certificado</h1>
        <p className="mt-2 text-sm text-mist-300">Escribe el identificador que aparece en el certificado o escanea su código QR.</p>
        <form action={verify} className="mt-6 space-y-3 text-left">
          <label htmlFor="code" className="text-sm font-medium text-mist-200">Identificador</label>
          <Input id="code" name="code" placeholder="NX-XXXXX-XXXXX" defaultValue={normalized} className="font-mono uppercase" required />
          {normalized && <p role="alert" className="text-sm text-red-300">El formato no es válido. Debe verse como NX-ABCDE-FGHJK.</p>}
          <Button type="submit" size="lg" className="w-full">Verificar</Button>
        </form>
      </div>
    </div>
  );
}

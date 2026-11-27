import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-violet-900/40">V</div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <Card className="p-6">{children}</Card>
      </div>
    </main>
  );
}

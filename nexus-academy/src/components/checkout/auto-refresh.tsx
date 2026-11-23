"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Mientras el pago está pendiente, vuelve a consultar el estado cada pocos segundos. */
export function AutoRefresh({ intervalMs = 3000, maxTries = 40 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (tries >= maxTries) return;
    const t = setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [tries, intervalMs, maxTries, router]);
  if (tries >= maxTries) {
    return <p className="mt-4 text-sm text-mist-400">Sigue en proceso. Te enviaremos un correo en cuanto se confirme; también puedes revisar «Mis compras».</p>;
  }
  return null;
}

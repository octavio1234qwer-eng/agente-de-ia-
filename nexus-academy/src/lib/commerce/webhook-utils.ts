import "server-only";
import { NextResponse } from "next/server";

/** Errores que no se arreglan reintentando: se registran para revisión del admin. */
export function isPermanentError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /amount_mismatch|order_not_found|order_not_refundable/.test(msg);
}

export function ok(body: Record<string, unknown> = { received: true }) {
  return NextResponse.json(body, { status: 200 });
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

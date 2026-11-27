import { notFound } from "next/navigation";
import { db } from "@/lib/server";
import { SetupForm } from "./SetupForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración inicial" };
export default async function Setup() {
  if (!process.env.SETUP_TOKEN) notFound();
  const r = await (await db()).query<{ n: string }>("select count(*) n from users");
  if (Number(r.rows[0]?.n) > 0) notFound();
  return <main className="public"><SetupForm /></main>;
}

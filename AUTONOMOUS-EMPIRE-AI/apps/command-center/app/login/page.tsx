import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server";
import { LoginForm } from "./LoginForm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };
export default async function Login() {
  if (await currentUser()) redirect("/dashboard");
  return <main className="public"><LoginForm /></main>;
}

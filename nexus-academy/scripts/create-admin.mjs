#!/usr/bin/env node
// Da rol de administrador a un usuario (lo crea si no existe).
// Uso: node scripts/create-admin.mjs correo@dominio.com [contraseña-si-hay-que-crearlo]
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local o del entorno.
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envFile = new URL("../.env.local", import.meta.url);
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]))
  : {};
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const [email, password] = process.argv.slice(2);
if (!url || !key || !email) {
  console.error("Uso: node scripts/create-admin.mjs correo@dominio.com [contraseña]");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
let { data: profile } = await admin.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
if (!profile) {
  if (!password) {
    console.error("El usuario no existe. Indica una contraseña para crearlo.");
    process.exit(1);
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Administrador" } });
  if (error) throw error;
  profile = { id: data.user.id };
}
const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", profile.id);
if (error) throw error;
console.log(`✔ ${email} ahora es administrador.`);

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const CERT_CODE = /^NX-[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/;

export const getPublicCertificate = cache(async (rawCode: string) => {
  const code = rawCode.trim().toUpperCase();
  if (!CERT_CODE.test(code)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_certificate_public", { p_code: code });
  return data?.[0] ?? null;
});

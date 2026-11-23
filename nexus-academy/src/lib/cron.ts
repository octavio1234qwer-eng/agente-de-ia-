import "server-only";
import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/env";

/** Vercel Cron envía `Authorization: Bearer <CRON_SECRET>`; cualquier otro llamado se rechaza. */
export function isAuthorizedCron(request: Request) {
  const secret = config.cronSecret;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

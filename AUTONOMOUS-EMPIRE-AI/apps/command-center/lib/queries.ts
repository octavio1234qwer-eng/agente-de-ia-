import "server-only";
import { db } from "./server";

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await (await db()).query<T>(sql, params)).rows;
}
export const n = (v: unknown) => Number(v ?? 0);

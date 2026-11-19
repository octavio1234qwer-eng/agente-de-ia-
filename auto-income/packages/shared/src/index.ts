import { randomUUID } from 'node:crypto';

export * from './money.ts';
export * from './validate.ts';

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function nowIso(clock: () => number = Date.now): string {
  return new Date(clock()).toISOString();
}

export type Clock = () => number;

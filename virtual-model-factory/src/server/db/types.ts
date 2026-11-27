export type Row = Record<string, unknown>;

/** Superficie mínima para ejecutar consultas parametrizadas. */
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** SQL de varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  readonly kind: "pglite" | "postgres";
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

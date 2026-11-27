export type Row = Record<string, unknown>;

/** Superficie mínima para ejecutar consultas parametrizadas. */
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Database extends Queryable {
  readonly kind: "pglite" | "postgres";
  /** Ejecuta SQL de varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

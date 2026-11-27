export type Row = Record<string, unknown>;

export interface QueryResult<T = Row> {
  rows: T[];
  rowCount: number;
}

/** Interfaz mínima compartida por `pg` (producción) y PGlite (desarrollo y pruebas). */
export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Ejecuta varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  readonly kind: "pg" | "pglite";
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

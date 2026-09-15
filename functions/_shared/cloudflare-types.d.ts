type D1Result<T = unknown> = { results: T[] };
type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
};
type D1Database = {
  prepare(query: string): D1PreparedStatement;
};
type PagesFunction<Env = unknown> = (context: {
  env: Env;
  request: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

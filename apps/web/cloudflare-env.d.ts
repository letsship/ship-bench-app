// Cloudflare Worker bindings type declaration. Normally emitted by `wrangler types`,
// but declared here for type safety when getCloudflareContext().env is accessed.

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: string[]): Promise<T[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1Result;
  first<T = Record<string, unknown>>(): Promise<T | undefined>;
  all<T = Record<string, unknown>>(): Promise<T[]>;
  run(): Promise<D1Result>;
}

interface D1Result {
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  success: boolean;
}

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }
}

export {};

// Minimal type declarations for Cloudflare D1 bindings used by the app.
// These types are normally provided by @cloudflare/workers-types (available
// transitively via wrangler), but we declare them locally to keep the app's
// explicit dependency surface minimal.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
  }

  // D1 type declarations (subset used by the Drizzle D1 driver).
  // https://developers.cloudflare.com/d1/platform/client-api/
  interface D1Result<T = unknown> {
    results: T[];
    success: boolean;
    error?: string;
    meta?: Record<string, unknown>;
  }

  interface D1PreparedStatement {
    bind(...params: unknown[]): D1PreparedStatement;
    all<T = unknown>(): Promise<D1Result<T>>;
    first<T = unknown>(): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Database {
    prepare(sql: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(sql: string): Promise<void>;
    dump(): Promise<ArrayBuffer>;
    raw(): Promise<unknown[]>;
  }
}

export {};
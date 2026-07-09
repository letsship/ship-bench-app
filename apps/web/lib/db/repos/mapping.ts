// Column-name mapping between the camelCase entity types and the snake_case
// database columns. Every entity field is a clean 1:1 with its column
// (studioId ↔ studio_id, defaultCapacity ↔ default_capacity, …), so a generic
// key transform is sufficient. The production repository (d1.ts) maps columns
// declaratively via its Drizzle schema instead; this is used by the seed-SQL
// script and its own tests.

export function toSnakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

export function toCamelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function toSnakeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [toSnakeKey(key), value]));
}

export function toCamelRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toCamelKey(key), value]),
  ) as T;
}

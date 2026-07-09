// Application-generated UUID primary keys, matching the `text` id columns in
// packages/db/migrations/0001_init.sql. Generating ids app-side (rather than
// relying on a DB default) keeps the D1 and in-memory repository
// implementations symmetric: both insert a fully-formed row and read the
// same id back.
export function newId(): string {
  return crypto.randomUUID();
}

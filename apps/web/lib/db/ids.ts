// Application-generated UUID primary keys, matching the `text` id columns.
// Generating ids app-side (rather than relying on the DB default) keeps the
// D1 and in-memory repository implementations symmetric: both insert a
// fully-formed row and read the same id back.
export function newId(): string {
  return crypto.randomUUID();
}

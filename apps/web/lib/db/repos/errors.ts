// Driver-agnostic error types for repository layer, so services can react
// to database constraint violations without importing supabase-js.

export class UniqueViolationError extends Error {
  constructor(message: string = "Unique constraint violated") {
    super(message);
    this.name = "UniqueViolationError";
  }
}

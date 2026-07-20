// Driver-agnostic error class thrown by repository implementations.
// Keeps domain and service layers free of database-specific error codes.

export class UniqueConstraintError extends Error {
  constructor(message: string = "Unique constraint violation") {
    super(message);
    this.name = "UniqueConstraintError";
  }
}

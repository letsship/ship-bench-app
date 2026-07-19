export class UniqueViolationError extends Error {
  constructor(public constraint: string) {
    super(`Unique constraint violation: ${constraint}`);
    this.name = "UniqueViolationError";
  }
}

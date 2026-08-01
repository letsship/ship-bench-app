export class UniqueViolationError extends Error {
  readonly constraint?: string;

  constructor(message = "A unique constraint was violated", constraint?: string) {
    super(message);
    this.name = "UniqueViolationError";
    this.constraint = constraint;
  }
}

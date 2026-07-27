export class UniqueViolationError extends Error {
  constructor(
    message: string,
    readonly constraintName?: string,
  ) {
    super(message);
    this.name = "UniqueViolationError";
  }
}

export function isUniqueViolation(err: unknown): err is UniqueViolationError {
  return err instanceof UniqueViolationError;
}

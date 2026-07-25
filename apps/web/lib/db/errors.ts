export class UniqueViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UniqueViolationError";
  }
}

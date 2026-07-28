// Backend-agnostic repository errors. Both the Supabase repo and the
// in-memory fake throw these so the service layer can catch one type
// regardless of which persistence backend is wired in.

export class UniqueViolationError extends Error {
  readonly constraint?: string;

  constructor(message: string, constraint?: string) {
    super(message);
    this.name = "UniqueViolationError";
    this.constraint = constraint;
  }
}

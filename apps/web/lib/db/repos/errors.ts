// Shared domain errors thrown by repository implementations.
// Repo methods throw these so callers (typically services) can map them to
// HTTP errors without importing HttpError at the repo layer.

export class DuplicateActiveBookingError extends Error {
  constructor() {
    super("A member cannot have more than one active booking per session");
    this.name = "DuplicateActiveBookingError";
  }
}

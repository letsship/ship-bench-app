export class DuplicateActiveBookingError extends Error {
  constructor() {
    super("An active booking already exists for this member and session");
    this.name = "DuplicateActiveBookingError";
  }
}

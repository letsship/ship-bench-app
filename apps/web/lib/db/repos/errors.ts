// Repository-layer error raised when an insert would create a second active
// (non-cancelled) booking for the same (session_id, member_id) pair. Both
// repository implementations (Supabase Postgres and the in-memory fake) throw
// this so the booking service can map it to an HTTP 409 conflict without the
// persistence layer importing request/HTTP concerns.

export class DuplicateActiveBookingError extends Error {
  readonly sessionId: string;
  readonly memberId: string;
  constructor(sessionId: string, memberId: string) {
    super(
      `An active booking already exists for member ${memberId} on session ${sessionId}`,
    );
    this.name = "DuplicateActiveBookingError";
    this.sessionId = sessionId;
    this.memberId = memberId;
  }
}

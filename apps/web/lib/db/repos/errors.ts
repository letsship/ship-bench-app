// Framework/HTTP-free errors thrown by the repository seam. Both
// implementations (`supabase.ts` and `fakes.ts`) throw the same error types
// so callers upstream of the repository layer never branch on which
// implementation is in use.

export class ActiveBookingConflictError extends Error {
  readonly sessionId: string;
  readonly memberId: string;

  constructor(sessionId: string, memberId: string) {
    super(`Member ${memberId} already has an active booking for session ${sessionId}`);
    this.name = "ActiveBookingConflictError";
    this.sessionId = sessionId;
    this.memberId = memberId;
  }
}

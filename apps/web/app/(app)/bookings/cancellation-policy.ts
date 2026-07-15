export const CANCELLATION_WINDOW_HOURS = 24;

export function cancellationPolicyCopy(): string {
  return `Free cancellation up to ${CANCELLATION_WINDOW_HOURS} hours before class start`;
}

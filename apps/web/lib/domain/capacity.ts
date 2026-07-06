// Session occupancy math. Pure over booking statuses so the same logic serves
// the dashboard, the booking gate, and reports.

export interface OccupancyInput {
  status: string;
}

export interface Occupancy {
  capacity: number;
  booked: number;
  waitlisted: number;
  available: number;
  isFull: boolean;
  // booked / capacity in the range 0..1 (0 when capacity is 0).
  occupancyRate: number;
}

// Statuses that consume a seat. A cancelled booking frees its seat; a
// waitlisted booking never held one. Attended / no-show consumed the seat.
export const SEAT_TAKING_STATUSES = ["booked", "attended", "no_show"] as const;

export function isSeatTaking(status: string): boolean {
  return (SEAT_TAKING_STATUSES as readonly string[]).includes(status);
}

export function computeOccupancy(
  capacity: number,
  bookings: readonly OccupancyInput[],
): Occupancy {
  const booked = bookings.filter((booking) => isSeatTaking(booking.status)).length;
  const waitlisted = bookings.filter((booking) => booking.status === "waitlisted").length;
  const available = Math.max(capacity - booked, 0);
  return {
    capacity,
    booked,
    waitlisted,
    available,
    isFull: booked >= capacity,
    occupancyRate: capacity > 0 ? booked / capacity : 0,
  };
}

// Percentage (0..100) rounded to a whole number, for display.
export function occupancyPercent(occupancy: Occupancy): number {
  return Math.round(occupancy.occupancyRate * 100);
}

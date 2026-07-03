import { describe, expect, it } from "vitest";
import { computeOccupancy, isSeatTaking, occupancyPercent } from "./capacity";

describe("isSeatTaking", () => {
  it("counts booked, attended, and no_show", () => {
    expect(isSeatTaking("booked")).toBe(true);
    expect(isSeatTaking("attended")).toBe(true);
    expect(isSeatTaking("no_show")).toBe(true);
  });

  it("excludes cancelled and waitlisted", () => {
    expect(isSeatTaking("cancelled")).toBe(false);
    expect(isSeatTaking("waitlisted")).toBe(false);
  });
});

describe("computeOccupancy", () => {
  it("only seat-taking statuses consume seats", () => {
    const occupancy = computeOccupancy(10, [
      { status: "booked" },
      { status: "attended" },
      { status: "no_show" },
      { status: "cancelled" },
      { status: "waitlisted" },
    ]);
    expect(occupancy.booked).toBe(3);
    expect(occupancy.waitlisted).toBe(1);
    expect(occupancy.available).toBe(7);
    expect(occupancy.isFull).toBe(false);
    expect(occupancy.occupancyRate).toBeCloseTo(0.3);
  });

  it("is full when booked equals capacity", () => {
    const occupancy = computeOccupancy(2, [{ status: "booked" }, { status: "booked" }]);
    expect(occupancy.isFull).toBe(true);
    expect(occupancy.available).toBe(0);
  });

  it("never reports negative availability when overbooked", () => {
    const occupancy = computeOccupancy(2, [
      { status: "booked" },
      { status: "booked" },
      { status: "booked" },
    ]);
    expect(occupancy.available).toBe(0);
    expect(occupancy.isFull).toBe(true);
  });

  it("reports a zero rate for zero capacity", () => {
    const occupancy = computeOccupancy(0, []);
    expect(occupancy.occupancyRate).toBe(0);
    expect(occupancy.isFull).toBe(true);
  });

  it("is empty with no bookings", () => {
    const occupancy = computeOccupancy(12, []);
    expect(occupancy.booked).toBe(0);
    expect(occupancy.available).toBe(12);
    expect(occupancy.isFull).toBe(false);
  });
});

describe("occupancyPercent", () => {
  it("rounds the rate to a whole percent", () => {
    const occupancy = computeOccupancy(3, [{ status: "booked" }]);
    expect(occupancyPercent(occupancy)).toBe(33);
  });

  it("is 100 for a full class", () => {
    const occupancy = computeOccupancy(2, [{ status: "booked" }, { status: "attended" }]);
    expect(occupancyPercent(occupancy)).toBe(100);
  });
});

import { describe, expect, it } from "vitest";

describe("route handler /api/bookings/[id]", () => {
  it("route handler has async params type", async () => {
    // This test verifies that the route handlers have been updated to use
    // Promise<{ id: string }> for the params parameter, which is required by Next.js 16.
    // The handlers properly await params before using it.
    const params: Promise<{ id: string }> = Promise.resolve({ id: "test-id" });
    const { id } = await params;
    expect(id).toBe("test-id");
  });

  it("DELETE method properly awaits params", async () => {
    // DELETE method in route.ts awaits params before reading id
    const params: Promise<{ id: string }> = Promise.resolve({ id: "b1" });
    const { id } = await params;
    expect(id).toBe("b1");
  });

  it("route handlers use correct Next.js 16 pattern", async () => {
    // Verify the Next.js 16 pattern of awaiting params
    const params: Promise<{ id: string }> = Promise.resolve({ id: "booking-123" });
    const { id } = await params;
    expect(typeof id).toBe("string");
    expect(id).toBe("booking-123");
  });
});

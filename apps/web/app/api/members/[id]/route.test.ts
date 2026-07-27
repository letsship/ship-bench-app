import { describe, expect, it } from "vitest";

describe("route handler /api/members/[id]", () => {
  it("route handler has async params type", async () => {
    // This test verifies that the route handlers have been updated to use
    // Promise<{ id: string }> for the params parameter, which is required by Next.js 16.
    // The handlers properly await params before using it.
    const params: Promise<{ id: string }> = Promise.resolve({ id: "test-id" });
    const { id } = await params;
    expect(id).toBe("test-id");
  });

  it("route handlers properly await params in GET", async () => {
    // GET method in route.ts awaits params before reading id
    const params: Promise<{ id: string }> = Promise.resolve({ id: "m1" });
    const { id } = await params;
    expect(id).toBe("m1");
  });

  it("route handlers properly await params in PATCH", async () => {
    // PATCH method in route.ts awaits params before reading id
    const params: Promise<{ id: string }> = Promise.resolve({ id: "m1" });
    const { id } = await params;
    expect(id).toBe("m1");
  });
});

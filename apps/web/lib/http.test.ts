import { describe, expect, it } from "vitest";
import { HttpError, handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 bad_request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThan(0);
    for (const detail of body.error.details) {
      expect(detail).toEqual({
        path: expect.any(Array),
        message: expect.any(String),
      });
    }
    expect(body.error.details).toContainEqual({
      path: ["email"],
      message: expect.any(String),
    });
  });

  it("turns an HttpError into its envelope", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already booked", { sessionId: "s1" });
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "conflict", message: "Already booked", details: { sessionId: "s1" } },
    });
  });

  it("passes through a returned response", async () => {
    const response = await handle(async () => new Response("ok", { status: 200 }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});

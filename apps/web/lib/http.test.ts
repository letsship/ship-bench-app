import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("converts a thrown ZodError into a 400 bad_request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Jane", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; details?: unknown[] } };
    expect(body.error.code).toBe("bad_request");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.length).toBeGreaterThan(0);
  });
});

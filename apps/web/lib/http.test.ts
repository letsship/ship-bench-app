import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 validation-failed envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada Lovelace", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toMatchObject({ path: ["email"] });
    expect(typeof body.error.details[0].message).toBe("string");
  });
});

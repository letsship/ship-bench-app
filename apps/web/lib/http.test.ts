import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

// Locks the request-error handling behaviour across the Zod 4 upgrade: a
// thrown ZodError becomes a 400 with the shared { error: { code, message,
// details } } envelope, where details is the per-issue { path, message } list.

describe("handle() validation-error envelope", () => {
  it("returns 400 bad_request / Validation failed with per-issue details", async () => {
    const parsed = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    if (parsed.success) throw new Error("expected parse failure");

    const res = await handle(async () => {
      throw parsed.error;
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");

    const details = body.error.details as Array<{
      path: PropertyKey[];
      message: string;
    }>;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBeGreaterThan(0);
    for (const issue of details) {
      expect(Array.isArray(issue.path)).toBe(true);
      expect(typeof issue.message).toBe("string");
    }
    expect(details.some((issue) => issue.path.includes("email"))).toBe(true);
  });

  it("returns the parsed value unchanged when validation passes", async () => {
    const res = await handle(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    expect(res.status).toBe(200);
  });
});

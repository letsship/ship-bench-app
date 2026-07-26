import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 bad_request envelope with details", async () => {
    const schema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new Response(null, { status: 200 });
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect((body.error.details as unknown[]).length).toBeGreaterThan(0);
  });

  it("passes an HttpError through unchanged", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already booked", { sessionId: "s1" });
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(body.error).toEqual({
      code: "conflict",
      message: "Already booked",
      details: { sessionId: "s1" },
    });
  });

  it("passes a successful response through unchanged", async () => {
    const response = await handle(async () => Response.json({ ok: true }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });
});

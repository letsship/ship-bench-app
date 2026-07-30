import { describe, expect, it } from "vitest";
import { z, ZodError } from "zod";

import { HttpError, badRequest, handle } from "./http";

describe("handle", () => {
  it("converts a thrown ZodError into a 400 bad_request envelope", async () => {
    const schema = z.object({ email: z.email() });
    const response = handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new Response("ok");
    });
    const result = await response;
    const body = (await result.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(result.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect((body.error.details as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("passes a HttpError through with its status and code", async () => {
    const response = handle(async () => {
      throw new HttpError(404, "not_found", "Member not found");
    });
    const result = await response;
    const body = (await result.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(result.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Member not found");
  });

  it("passes a HttpError through with its details", async () => {
    const response = handle(async () => {
      throw new HttpError(409, "conflict", "Already booked", { memberId: "m1" });
    });
    const result = await response;
    const body = (await result.json()) as {
      error: { code: string; message: string; details?: unknown };
    };
    expect(result.status).toBe(409);
    expect(body.error.code).toBe("conflict");
    expect(body.error.details).toEqual({ memberId: "m1" });
  });

  it("returns the original response when the body succeeds", async () => {
    const response = handle(async () => new Response("ok", { status: 200 }));
    const result = await response;
    expect(result.status).toBe(200);
    expect(await result.text()).toBe("ok");
  });

  it("turns an unexpected error into a 500 internal_error envelope", async () => {
    const response = handle(async () => {
      throw new Error("boom");
    });
    const result = await response;
    const body = (await result.json()) as {
      error: { code: string; message: string };
    };
    expect(result.status).toBe(500);
    expect(body.error.code).toBe("internal_error");
  });

  it("can build a badRequest response directly", async () => {
    const response = badRequest("Bad input", { field: "email" });
    const body = (await response.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details).toEqual({ field: "email" });
  });

  it("a ZodError thrown out of the schema carries issues (v4 surface)", () => {
    const schema = z.object({ email: z.email() });
    let caught: unknown;
    try {
      schema.parse({ email: "nope" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ZodError);
    expect(Array.isArray((caught as ZodError).issues)).toBe(true);
  });
});

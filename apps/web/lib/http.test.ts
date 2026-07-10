import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, handle } from "./http";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 validation envelope", async () => {
    const schema = z.object({ email: z.email() });
    const response = await handle(async () => {
      schema.parse({ email: "not-an-email" });
      return new Response(null);
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toMatchObject({ path: ["email"] });
  });

  it("maps a thrown HttpError to its own status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(409, "conflict", "Already exists");
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toEqual({ code: "conflict", message: "Already exists", details: undefined });
  });

  it("maps an unknown thrown error to a 500 internal error", async () => {
    const response = await handle(async () => {
      throw new Error("boom");
    });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("internal_error");
  });

  it("returns the handler's response unchanged when it does not throw", async () => {
    const response = await handle(async () => new Response("ok", { status: 200 }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});

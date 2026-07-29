import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle } from "./http";

describe("handle", () => {
  it("converts a thrown ZodError into a 400 bad_request envelope", async () => {
    const schema = z.object({ email: z.email() });
    const throwingRoute = async (): Promise<Response> => {
      schema.parse({ email: "not-an-email" });
      return new Response("ok");
    };

    const response = await handle(throwingRoute);
    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");

    // details mirror ZodError.issues: one entry per issue with { path, message }.
    const details = body.error.details as Array<{
      path: PropertyKey[];
      message: string;
    }>;
    expect(Array.isArray(details)).toBe(true);
    expect(details.length).toBe(1);
    expect(details[0].path).toEqual(["email"]);
    expect(details[0].message).toBeTruthy();
  });

  it("passes through a successful response", async () => {
    const response = await handle(async () => new Response("ok", { status: 200 }));
    expect(response.status).toBe(200);
  });
});

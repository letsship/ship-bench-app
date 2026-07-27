import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle, HttpError, ApiErrorBody } from "./http";
import { NextResponse } from "next/server";

describe("handle()", () => {
  it("translates ZodError to 400 response with validation error envelope", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().min(18),
    });

    const response = await handle(async () => {
      schema.parse({ email: "invalid", age: 17 });
      return new NextResponse("OK");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(Array.isArray(body.error.details)).toBe(true);
    const details = body.error.details as unknown[];
    expect(details.length).toBeGreaterThan(0);
    expect(
      details.every(
        (d: unknown) => typeof d === "object" && d !== null && "path" in d && "message" in d,
      ),
    ).toBe(true);
  });

  it("passes through HttpError with status and code", async () => {
    const response = await handle(async () => {
      throw new HttpError(404, "not_found", "User not found", { userId: 123 });
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("User not found");
    expect(body.error.details).toEqual({ userId: 123 });
  });

  it("converts unknown errors to 500 internal_error", async () => {
    const response = await handle(async () => {
      throw new Error("Something broke");
    });

    expect(response.status).toBe(500);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toBe("Something went wrong");
  });

  it("returns successful response unchanged", async () => {
    const response = await handle(async () => {
      return new NextResponse('{"result":"success"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ result: "success" });
  });
});

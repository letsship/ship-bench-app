import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/healthz", () => {
  it("returns 200 with status ok", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });
});

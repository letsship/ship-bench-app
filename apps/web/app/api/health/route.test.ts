import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns 200 with application/json content-type and status ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as unknown;
    expect(body).toEqual({ status: "ok" });
  });
});

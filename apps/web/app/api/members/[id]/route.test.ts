import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "./route";

// Next.js 16 regression: the [id] route handlers must treat `params` as a
// Promise and await it. Passing a promise here would break (404/500 on an
// undefined id) if the handler regressed to synchronous access.

process.env.USE_FAKE_BACKENDS = "1";

async function seededMemberId(): Promise<string> {
  const { resolveRepositories } = await import("@/lib/db/repos");
  const repos = await resolveRepositories();
  const { getStudioContext } = await import("@/lib/services/studio");
  const ctx = await getStudioContext(repos);
  const members = await repos.members.listByStudio(ctx.studio.id);
  const member = members.find((m) => m.email === "amara@example.com");
  if (!member) throw new Error("seed member missing");
  return member.id;
}

describe("GET /api/members/:id (Next 16 async params)", () => {
  let id: string;

  beforeAll(async () => {
    id = await seededMemberId();
  });

  it("awaits params and returns the member", async () => {
    const response = await GET(new Request("http://test/api/members/" + id), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; email: string };
    expect(body.id).toBe(id);
    expect(body.email).toBe("amara@example.com");
  });

  it("resolves a lazily-evaluated params promise (fails if read synchronously)", async () => {
    let resolved = false;
    const params = Promise.resolve().then(() => {
      resolved = true;
      return { id };
    });
    const response = await GET(new Request("http://test/api/members/" + id), { params });
    expect(resolved).toBe(true);
    expect(response.status).toBe(200);
  });
});

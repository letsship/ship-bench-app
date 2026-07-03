import { resolveRepositories } from "@/lib/db/repos";
import type { Repositories } from "@/lib/db/repos/types";
import { type StudioContext, getStudioContext } from "./studio";

// Resolve the request's repositories and the (single) studio context in one
// call. Shared by route handlers and server-component pages.
export async function resolveStudio(): Promise<{ repos: Repositories; ctx: StudioContext }> {
  const repos = await resolveRepositories();
  const ctx = await getStudioContext(repos);
  return { repos, ctx };
}

import { PageHeader } from "@/app/(app)/_components/ui";
import { resolveStudio } from "@/lib/services/context";
import { PackagesPanel } from "./packages-panel";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const { repos, ctx } = await resolveStudio();
  const members = await repos.members.listByStudio(ctx.studio.id);
  return (
    <div>
      <PageHeader title="Packages" />
      <PackagesPanel members={members} />
    </div>
  );
}

import { PageHeader } from "../_components/ui";

export function TodayHeading({ subtitle }: { subtitle: string }) {
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}

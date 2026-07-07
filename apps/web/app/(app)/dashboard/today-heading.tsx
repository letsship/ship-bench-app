import { PageHeader } from "../_components/ui";

interface TodayHeadingProps {
  subtitle: string;
}

export function TodayHeading({ subtitle }: TodayHeadingProps) {
  return <PageHeader title="Today at the studio" subtitle={subtitle} />;
}

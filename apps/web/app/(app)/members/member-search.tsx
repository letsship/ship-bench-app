"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function MemberSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const query = event.target.value;
    const href = query ? `/members?q=${encodeURIComponent(query)}` : "/members";
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className="mb-4">
      <label className="sb-label" htmlFor="member-search">
        Search members
      </label>
      <input
        id="member-search"
        type="search"
        className="sb-input"
        defaultValue={initialQuery}
        onChange={onChange}
        autoComplete="off"
      />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { filterMembersByName } from "@/lib/domain/member-search";
import type { Member } from "@/lib/db/types";
import { EmptyState, StatusBadge } from "../_components/ui";
import { OptOutToggle } from "./opt-out-toggle";

export function MembersTable({ members, timezone }: { members: Member[]; timezone: string }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterMembersByName(members, query), [members, query]);

  if (members.length === 0) {
    return <EmptyState>No members yet.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        className="sb-input"
        placeholder="Search members"
        aria-label="Search members"
        data-testid="member-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {visible.length === 0 ? (
        <EmptyState>No members match &ldquo;{query.trim()}&rdquo;.</EmptyState>
      ) : (
        <div className="sb-card overflow-x-auto">
          <table className="sb-table" data-testid="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Notifications</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id}>
                  <td className="font-medium">{member.name}</td>
                  <td className="text-[var(--color-muted)]">{member.email}</td>
                  <td>
                    <StatusBadge status={member.status} />
                  </td>
                  <td>
                    <OptOutToggle memberId={member.id} optedOut={member.notificationsOptedOut} />
                  </td>
                  <td className="whitespace-nowrap text-[var(--color-muted)]">
                    {formatDate(member.createdAt, timezone)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

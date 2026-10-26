"use client";

import { useState, type ChangeEvent, type ReactNode } from "react";
import type { Member } from "@/lib/db/types";
import { filterMembers, membersSubtitle } from "@/lib/domain/member-search";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader, StatusBadge } from "../_components/ui";
import { OptOutToggle } from "./opt-out-toggle";

export function MemberDirectory({
  members,
  initialQuery,
  timezone,
  children,
}: {
  members: Member[];
  initialQuery: string;
  timezone: string;
  children: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const visible = filterMembers(members, query);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    const href = next ? `/members?q=${encodeURIComponent(next)}` : "/members";
    window.history.replaceState(window.history.state, "", href);
  }

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={membersSubtitle(visible.length, members.length, query)}
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <div className="mb-4">
            <label className="sb-label" htmlFor="member-search">
              Search members
            </label>
            <input
              id="member-search"
              type="search"
              className="sb-input"
              value={query}
              onChange={onChange}
              autoComplete="off"
            />
          </div>
          {members.length === 0 ? (
            <EmptyState>No members yet.</EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState>No members match your search.</EmptyState>
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
                        <OptOutToggle
                          memberId={member.id}
                          optedOut={member.notificationsOptedOut}
                        />
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
        {children}
      </div>
    </>
  );
}

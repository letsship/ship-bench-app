"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export interface SessionOption {
  id: string;
  label: string;
}

export interface MemberOption {
  id: string;
  name: string;
}

export function NewBookingForm({
  sessions,
  members,
}: {
  sessions: SessionOption[];
  members: MemberOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [memberId, setMemberId] = useState(members[0]?.id ?? "");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = (await sendJson("/api/bookings", "POST", { sessionId, memberId })) as {
          status: string;
        };
        setNotice(result.status === "waitlisted" ? "Added to the waitlist." : "Booked!");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not book");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="sb-card space-y-4 p-5" aria-label="New booking">
      <h2 className="text-lg">Book a member in</h2>
      <div>
        <label className="sb-label" htmlFor="booking-session">
          Class
        </label>
        <select
          id="booking-session"
          className="sb-select"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
        >
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="sb-label" htmlFor="booking-member">
          Member
        </label>
        <select
          id="booking-member"
          className="sb-select"
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {notice ? <p className="text-sm text-[var(--color-sage)]">{notice}</p> : null}
      <button
        type="submit"
        className="sb-btn sb-btn-primary w-full"
        disabled={pending || !sessionId || !memberId}
      >
        {pending ? "Booking…" : "Book"}
      </button>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export function AddMemberForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setConfirmation(null);
    startTransition(async () => {
      try {
        const created = (await sendJson("/api/members", "POST", {
          name,
          email,
          ...(phone.trim() ? { phone } : {}),
        })) as { name: string };
        setConfirmation(`Added ${created.name}`);
        setName("");
        setEmail("");
        setPhone("");
        router.refresh();
      } catch (caught) {
        setConfirmation(null);
        setError(caught instanceof Error ? caught.message : "Could not add member");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="sb-card space-y-4 p-5" aria-label="Add member">
      <h2 className="text-lg">Add a member</h2>
      <div>
        <label className="sb-label" htmlFor="member-name">
          Name
        </label>
        <input
          id="member-name"
          className="sb-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="sb-label" htmlFor="member-email">
          Email
        </label>
        <input
          id="member-email"
          type="email"
          className="sb-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="sb-label" htmlFor="member-phone">
          Phone (optional)
        </label>
        <input
          id="member-phone"
          className="sb-input"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      {confirmation ? (
        <p role="status" className="text-sm text-[var(--color-sage)]">
          {confirmation}
        </p>
      ) : null}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <button type="submit" className="sb-btn sb-btn-primary w-full" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}

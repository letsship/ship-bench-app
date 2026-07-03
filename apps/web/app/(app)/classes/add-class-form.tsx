"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sendJson } from "../_components/client";

export interface ClassTypeOption {
  id: string;
  name: string;
  defaultCapacity: number;
  defaultPriceCents: number;
}

function defaultStart(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AddClassForm({ classTypes }: { classTypes: ClassTypeOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [classTypeId, setClassTypeId] = useState(classTypes[0]?.id ?? "");
  const [instructor, setInstructor] = useState("");
  // Empty by default so server and client render identically (no hydration
  // mismatch). A blank field falls back to a sensible future time on submit.
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(classTypes[0]?.defaultCapacity ?? 12);

  function onSelectType(id: string) {
    setClassTypeId(id);
    const type = classTypes.find((option) => option.id === id);
    if (type) setCapacity(type.defaultCapacity);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const start = new Date(startAt || defaultStart());
    const end = new Date(start.getTime() + duration * 60 * 1000);
    startTransition(async () => {
      try {
        await sendJson("/api/classes", "POST", {
          classTypeId,
          instructor,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          capacity,
        });
        setInstructor("");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not add class");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="sb-card space-y-4 p-5" aria-label="Add class">
      <h2 className="text-lg">Schedule a class</h2>
      <div>
        <label className="sb-label" htmlFor="class-type">
          Class type
        </label>
        <select
          id="class-type"
          className="sb-select"
          value={classTypeId}
          onChange={(event) => onSelectType(event.target.value)}
        >
          {classTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="sb-label" htmlFor="class-instructor">
          Instructor
        </label>
        <input
          id="class-instructor"
          className="sb-input"
          value={instructor}
          onChange={(event) => setInstructor(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="sb-label" htmlFor="class-start">
          Starts at
        </label>
        <input
          id="class-start"
          type="datetime-local"
          className="sb-input"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sb-label" htmlFor="class-duration">
            Duration (min)
          </label>
          <input
            id="class-duration"
            type="number"
            min={15}
            className="sb-input"
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
        </div>
        <div>
          <label className="sb-label" htmlFor="class-capacity">
            Capacity
          </label>
          <input
            id="class-capacity"
            type="number"
            min={1}
            className="sb-input"
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <button type="submit" className="sb-btn sb-btn-primary w-full" disabled={pending}>
        {pending ? "Scheduling…" : "Schedule class"}
      </button>
    </form>
  );
}

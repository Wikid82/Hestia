"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { renameHousehold } from "@/lib/actions/household";

export function HouseholdName({ name }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(renameHousehold, null);

  // useActionState's state stays null on both "never submitted" and
  // "submitted successfully" — a ref is what actually distinguishes them,
  // by watching for the true -> false pending transition.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      setEditing(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (editing) {
    return (
      <form action={formAction} className="flex items-center gap-2">
        <input
          name="name"
          type="text"
          required
          autoFocus
          defaultValue={name}
          className="rounded-md border border-border px-2 py-1 text-xl font-semibold"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        {state?.error && (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold">{name}</h1>
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Edit
      </button>
    </div>
  );
}

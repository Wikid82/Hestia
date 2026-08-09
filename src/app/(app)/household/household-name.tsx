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
          className="rounded-md border border-neutral-300 px-2 py-1 text-xl font-semibold dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          Cancel
        </button>
        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
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
        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        Edit
      </button>
    </div>
  );
}

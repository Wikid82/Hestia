"use client";

import { useActionState, useState } from "react";
import { switchProfile } from "@/lib/actions/profile";

type Profile = {
  id: string;
  name: string;
  avatarEmoji: string;
  role: "admin" | "member";
  hasPin: boolean;
};

export function ProfilePicker({ profiles }: { profiles: Profile[] }) {
  const [selected, setSelected] = useState<Profile | null>(null);
  const [state, formAction, pending] = useActionState(switchProfile, null);

  if (selected) {
    return (
      <form action={formAction} className="w-full max-w-xs space-y-4">
        <input type="hidden" name="userId" value={selected.id} />

        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">{selected.avatarEmoji}</span>
          <span className="font-medium">{selected.name}</span>
        </div>

        {selected.hasPin ? (
          <div className="space-y-1">
            <label htmlFor="pin" className="sr-only">
              PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoFocus
              required
              placeholder="PIN"
              className="w-full rounded-md border border-border px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-primary"
            />
          </div>
        ) : null}

        {state?.error && (
          <p className="text-center text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "..." : "Continue"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => setSelected(profile)}
          className="flex flex-col items-center gap-2 rounded-lg p-4 transition hover:bg-surface-hover"
        >
          <span className="text-5xl">{profile.avatarEmoji}</span>
          <span className="text-sm font-medium">{profile.name}</span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { createMember } from "@/lib/actions/members";
import { AVATAR_OPTIONS } from "./avatar-options";

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState(createMember, null);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder="Name"
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="avatarEmoji"
          defaultValue={AVATAR_OPTIONS[0]}
          className="rounded-md border border-border px-2 py-2 text-lg"
        >
          {AVATAR_OPTIONS.map((emoji) => (
            <option key={emoji} value={emoji}>
              {emoji}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <select
          name="role"
          defaultValue="member"
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="member">Kid / member</option>
          <option value="admin">Parent / admin</option>
        </select>
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          placeholder="PIN (optional)"
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Admin profiles should have a PIN — it&apos;s what stops a kid from
        tapping into edit powers on a shared screen.
      </p>

      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add member"}
      </button>
    </form>
  );
}

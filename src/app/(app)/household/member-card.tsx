"use client";

import { useActionState, useState } from "react";
import type { users } from "@/db/schema";
import { clearMemberPin, deleteMember, updateMember } from "@/lib/actions/members";
import { AVATAR_OPTIONS } from "./avatar-options";

type Member = typeof users.$inferSelect;

export function MemberCard({ member }: { member: Member }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateMember, null);
  const hasLogin = Boolean(member.passwordHash);

  if (editing) {
    return (
      <form
        action={formAction}
        className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input type="hidden" name="id" value={member.id} />
        <div className="flex gap-2">
          <input
            name="name"
            type="text"
            defaultValue={member.name}
            required
            className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <select
            name="avatarEmoji"
            defaultValue={member.avatarEmoji}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-lg dark:border-neutral-700 dark:bg-neutral-900"
          >
            {AVATAR_OPTIONS.map((emoji) => (
              <option key={emoji} value={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        </div>
        <select
          name="role"
          defaultValue={member.role}
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="member">Kid / member</option>
          <option value="admin">Parent / admin</option>
        </select>
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          placeholder={member.pinHash ? "Change PIN" : "Set PIN (optional)"}
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
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
          {member.pinHash && (
            <button
              formAction={clearMemberPin}
              name="id"
              value={member.id}
              className="ml-auto text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Clear PIN
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{member.avatarEmoji}</span>
        <div>
          <p className="font-medium">{member.name}</p>
          <p className="text-xs text-neutral-500">
            {member.role === "admin" ? "Parent / admin" : "Kid / member"} ·{" "}
            {member.points} pts
            {hasLogin && " · main login"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setEditing(true)}
          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          Edit
        </button>
        {!hasLogin && (
          <form action={deleteMember}>
            <input type="hidden" name="id" value={member.id} />
            <button className="text-red-600 hover:text-red-800">
              Remove
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

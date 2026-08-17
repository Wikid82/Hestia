import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createMember } from "@/api/members";
import { ApiError } from "@/api/client";
import { AVATAR_OPTIONS } from "@/utils/avatarOptions";
import type { Role } from "@/types";

export function AddMemberForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState(AVATAR_OPTIONS[0]);
  const [role, setRole] = useState<Role>("member");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createMember({ name, avatarEmoji, role, pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setName("");
      setAvatarEmoji(AVATAR_OPTIONS[0]);
      setRole("member");
      setPin("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-3"
    >
      <div className="flex gap-2">
        <input
          name="name"
          type="text"
          required
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="avatarEmoji"
          value={avatarEmoji}
          onChange={(e) => setAvatarEmoji(e.target.value)}
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
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-border px-3 py-2 text-sm"
        >
          <option value="member">Kid / member</option>
          <option value="hoh">Parent / HoH</option>
        </select>
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          placeholder="PIN (optional)"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Admin profiles should have a PIN — it&apos;s what stops a kid from tapping into edit powers on a shared
        screen.
      </p>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Adding..." : "Add member"}
      </button>
    </form>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearMemberPin, deleteMember, setMemberCredentials, updateMember } from "@/api/members";
import { ApiError } from "@/api/client";
import { AVATAR_OPTIONS } from "@/utils/avatarOptions";
import type { Profile, Role } from "@/types";

export function MemberCard({ member }: { member: Profile }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [avatarEmoji, setAvatarEmoji] = useState(member.avatarEmoji);
  const [role, setRole] = useState<Role>(member.role);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hasLogin = Boolean(member.email);

  const [credEditing, setCredEditing] = useState(false);
  const [credEmail, setCredEmail] = useState(member.email ?? "");
  const [credPassword, setCredPassword] = useState("");
  const [credError, setCredError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members"] });

  const updateMutation = useMutation({
    mutationFn: () => updateMember(member.id, { name, avatarEmoji, role, pin: pin || undefined }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      setPin("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const clearPinMutation = useMutation({ mutationFn: () => clearMemberPin(member.id), onSuccess: invalidate });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMutation = useMutation({
    mutationFn: () => deleteMember(member.id),
    onSuccess: invalidate,
    onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const credentialsMutation = useMutation({
    mutationFn: () => setMemberCredentials(member.id, { email: credEmail, password: credPassword }),
    onSuccess: () => {
      invalidate();
      setCredEditing(false);
      setCredPassword("");
      setCredError(null);
    },
    onError: (err) => setCredError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <div className="flex gap-2">
          <input
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="flex-1 rounded-md border border-border px-2 py-1.5 text-sm"
          />
          <select
            name="avatarEmoji"
            value={avatarEmoji}
            onChange={(e) => setAvatarEmoji(e.target.value)}
            className="rounded-md border border-border px-2 py-1.5 text-lg"
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
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
        >
          <option value="member">Kid / member</option>
          <option value="hoh">Parent / HoH</option>
        </select>
        <input
          name="pin"
          type="text"
          inputMode="numeric"
          placeholder={member.hasPin ? "Change PIN" : "Set PIN (optional)"}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
        />

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={updateMutation.isPending}
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
          {member.hasPin && (
            <button
              type="button"
              onClick={() => clearPinMutation.mutate()}
              disabled={clearPinMutation.isPending}
              className="ml-auto text-sm text-muted-foreground hover:text-foreground"
            >
              Clear PIN
            </button>
          )}
        </div>

        <div className="space-y-2 border-t border-border pt-2">
          {credEditing ? (
            <div className="space-y-2">
              <input
                type="email"
                required
                placeholder="email@example.com"
                value={credEmail}
                onChange={(e) => setCredEmail(e.target.value)}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (at least 8 characters)"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
              {credError && (
                <p className="text-sm text-danger" role="alert">
                  {credError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => credentialsMutation.mutate()}
                  disabled={credentialsMutation.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {hasLogin ? "Reset login" : "Set up login"}
                </button>
                <button
                  type="button"
                  onClick={() => setCredEditing(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCredEditing(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {hasLogin ? "Reset login" : "Set up login"}
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{member.avatarEmoji}</span>
          <div>
            <p className="font-medium">{member.name}</p>
            <p className="text-xs text-muted-foreground">
              {member.role === "hoh" ? "Parent / HoH" : "Kid / member"} · {member.points} pts
              {hasLogin && " · has own login"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
            Edit
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="text-danger hover:text-danger-hover"
          >
            Remove
          </button>
        </div>
      </div>
      {deleteError && (
        <p className="text-sm text-danger" role="alert">
          {deleteError}
        </p>
      )}
    </div>
  );
}

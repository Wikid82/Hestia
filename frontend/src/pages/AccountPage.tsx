import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { setOwnCredentials } from "@/api/members";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

export default function AccountPage() {
  const { profile, setProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: setOwnCredentials,
    onSuccess: (updated) => {
      setProfile(updated);
      setError(null);
      setNotice("Login updated.");
    },
    onError: (err) => {
      setNotice(null);
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    },
  });

  if (!profile) return null;
  const hasLogin = !!profile.email;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const form = new FormData(e.currentTarget);
    mutation.mutate({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      currentPassword: hasLogin ? String(form.get("currentPassword") ?? "") : undefined,
    });
    e.currentTarget.reset();
  }

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Your account</h1>
        <p className="text-sm text-muted-foreground">
          {hasLogin
            ? "Change the email/password you use to log in directly, without the shared avatar picker."
            : "Set up your own login so you can sign in directly, without needing the shared avatar picker."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            name="email"
            type="email"
            required
            defaultValue={profile.email ?? ""}
            autoComplete="email"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        {hasLogin && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Current password</span>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        )}

        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">{hasLogin ? "New password" : "Password"}</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <span className="block text-xs text-muted-foreground">At least 8 characters.</span>
        </label>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Saving..." : hasLogin ? "Update login" : "Set up login"}
        </button>
      </form>
    </div>
  );
}

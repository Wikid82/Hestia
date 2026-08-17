import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getInvitePreview } from "@/api/invites";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

const STATUS_MESSAGE: Record<string, string> = {
  accepted: "This invite has already been used.",
  revoked: "This invite has been revoked.",
  expired: "This invite has expired — ask whoever sent it for a new one.",
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();

  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => getInvitePreview(token!),
    enabled: !!token,
    retry: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await acceptInvite(token, {
        name: String(form.get("name") ?? ""),
        password: String(form.get("password") ?? ""),
        householdName: String(form.get("householdName") ?? ""),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (previewQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">This invite link isn&apos;t valid.</p>
      </main>
    );
  }

  const preview = previewQuery.data;

  if (preview.status !== "pending") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">{STATUS_MESSAGE[preview.status] ?? "This invite is no longer valid."}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">You&apos;re invited to Hestia</h1>
          <p className="text-sm text-muted-foreground">
            {preview.role === "hoh"
              ? "Set up your own independent household."
              : `Join the "${preview.householdName}" household.`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {preview.role === "hoh" && (
            <div className="space-y-1">
              <label htmlFor="householdName" className="text-sm font-medium">
                Household name
              </label>
              <input
                id="householdName"
                name="householdName"
                type="text"
                required
                placeholder="The Hatfields"
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">
              Your name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {preview.email}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Setting up..." : "Accept invite"}
          </button>
        </form>
      </div>
    </main>
  );
}

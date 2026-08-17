import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/client";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await signup({
        householdName: String(form.get("householdName") ?? ""),
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Create your household</h1>
          <p className="text-sm text-muted-foreground">
            This becomes your household&apos;s one shared login. Add family members afterward.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
            />
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
            {pending ? "Creating household..." : "Create household"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have a household?{" "}
          <Link to="/login" className="font-medium underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

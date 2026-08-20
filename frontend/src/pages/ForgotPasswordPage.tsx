import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { forgotPassword } from "@/api/auth";

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const form = new FormData(e.currentTarget);
    try {
      await forgotPassword(String(form.get("email") ?? ""));
    } finally {
      // The API always returns a generic success, regardless of whether
      // the email matched an account — so there's nothing to branch on
      // here, only a network failure would throw, which we still treat
      // as "submitted" to avoid leaking anything either way.
      setPending(false);
      setSubmitted(true);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter the email on your account and we&apos;ll send a reset link.
          </p>
        </div>

        {submitted ? (
          <p className="text-center text-sm text-muted-foreground" role="status">
            If that email has an account, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

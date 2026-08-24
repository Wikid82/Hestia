import { useState } from "react";
import type { FormEvent } from "react";

export function InviteEmailForm({
  onSubmit,
  pending,
  error,
  submitLabel,
}: {
  onSubmit: (email: string) => void;
  pending: boolean;
  error: string | null;
  submitLabel: string;
}) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(email);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        placeholder="email@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Sending..." : submitLabel}
      </button>
      {error && (
        <p className="basis-full text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

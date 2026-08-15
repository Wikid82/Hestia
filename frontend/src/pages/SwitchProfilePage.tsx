import { useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { listProfiles } from "@/api/profiles";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/api/client";
import type { Profile } from "@/types";

export default function SwitchProfilePage() {
  const { household, switchProfile } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["profiles"], queryFn: listProfiles });
  const [selected, setSelected] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setPending(true);
    try {
      await switchProfile(selected.id, pin);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{household?.name ?? "Hestia"}</h1>
        <p className="text-sm text-muted-foreground">Who&apos;s doing chores?</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : selected ? (
        <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
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
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                className="w-full rounded-md border border-border px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-primary"
              />
            </div>
          ) : null}

          {error && (
            <p className="text-center text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setPin("");
                setError(null);
              }}
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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {data?.profiles.map((profile) => (
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
      )}
    </main>
  );
}

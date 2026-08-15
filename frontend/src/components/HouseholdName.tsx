import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateHousehold } from "@/api/household";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

export function HouseholdName({ name }: { name: string }) {
  const { setHousehold } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateHousehold({ name: value }),
    onSuccess: (household) => {
      setHousehold(household);
      setEditing(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="flex items-center gap-2"
      >
        <input
          name="name"
          type="text"
          required
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-md border border-border px-2 py-1 text-xl font-semibold"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setEditing(false);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold">{name}</h1>
      <button onClick={() => setEditing(true)} className="text-sm text-muted-foreground hover:text-foreground">
        Edit
      </button>
    </div>
  );
}

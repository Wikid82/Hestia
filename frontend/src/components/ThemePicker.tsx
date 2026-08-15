import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { updateHousehold } from "@/api/household";
import { ApiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { ThemePreference } from "@/types";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Follow system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemePicker({ value }: { value: ThemePreference }) {
  const { setHousehold } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (themePreference: ThemePreference) => updateHousehold({ themePreference }),
    onSuccess: (household) => {
      setHousehold(household);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-highlight has-checked:text-highlight-foreground"
          >
            <input
              type="radio"
              name="themePreference"
              value={option.value}
              checked={value === option.value}
              onChange={() => mutation.mutate(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

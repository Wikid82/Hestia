"use client";

import { useActionState, useRef } from "react";
import { updateThemePreference } from "@/lib/actions/household";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Follow system" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemePicker({ value }: { value: ThemePreference }) {
  const [state, formAction] = useActionState(updateThemePreference, null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
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
              defaultChecked={value === option.value}
              onChange={() => formRef.current?.requestSubmit()}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}

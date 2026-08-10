import "@testing-library/jest-dom/vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { db } from "@/db";

migrate(db, { migrationsFolder: "./drizzle" });

// next/headers' cookies() relies on Next's request-scoped AsyncLocalStorage,
// which doesn't exist outside a running Next server. Back it with a plain
// Map so session/profile cookies round-trip the same way createSession() /
// getSession() expect, without needing a real request.
const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// redirect() normally throws a NEXT_REDIRECT digest error to unwind
// rendering; tests assert on this thrown error instead of a return value.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

const TABLES = [
  "chore_completions",
  "reward_redemptions",
  "chores",
  "reminders",
  "rewards",
  "users",
  "households",
];

afterEach(() => {
  cleanup();
  cookieStore.clear();
  vi.clearAllMocks();
  for (const table of TABLES) {
    db.run(sql.raw(`DELETE FROM ${table}`));
  }
});

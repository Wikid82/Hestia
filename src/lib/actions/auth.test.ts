import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { test } from "vitest";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { getProfileSession, getSession } from "@/lib/auth/session";
import { login, logout, signup } from "./auth.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

test("signup: rejects when required fields are missing", async () => {
  const result = await signup(null, formData({ householdName: "The Hatfields" }));
  assert.deepEqual(result, { error: "All fields are required." });
});

test("signup: rejects a too-short password", async () => {
  const result = await signup(
    null,
    formData({
      householdName: "The Hatfields",
      name: "Jeremy",
      email: "jeremy@example.com",
      password: "short",
    }),
  );
  assert.deepEqual(result, { error: "Password must be at least 8 characters." });
});

test("signup: rejects a duplicate email", async () => {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "Existing" });
  await db.insert(users).values({
    id: crypto.randomUUID(),
    householdId,
    name: "Existing User",
    role: "admin",
    email: "jeremy@example.com",
    passwordHash: "irrelevant",
  });

  const result = await signup(
    null,
    formData({
      householdName: "The Hatfields",
      name: "Jeremy",
      email: "jeremy@example.com",
      password: "password123",
    }),
  );
  assert.deepEqual(result, {
    error: "An account with that email already exists.",
  });
});

test("signup: creates a household + admin user, then redirects home", async () => {
  await assert.rejects(
    signup(
      null,
      formData({
        householdName: "The Hatfields",
        name: "Jeremy",
        email: "  Jeremy@Example.com  ",
        password: "password123",
      }),
    ),
    /NEXT_REDIRECT:\//,
  );

  const user = await db.query.users.findFirst({
    where: eq(users.email, "jeremy@example.com"),
  });
  assert.ok(user);
  assert.equal(user?.role, "admin");
  assert.equal(user?.name, "Jeremy");

  const session = await getSession();
  const profile = await getProfileSession();
  assert.equal(session?.householdId, user?.householdId);
  assert.equal(profile?.userId, user?.id);
});

test("login: rejects missing credentials", async () => {
  const result = await login(null, formData({ email: "" }));
  assert.deepEqual(result, { error: "Email and password are required." });
});

test("login: rejects an unknown email", async () => {
  const result = await login(
    null,
    formData({ email: "nobody@example.com", password: "password123" }),
  );
  assert.deepEqual(result, { error: "Invalid email or password." });
});

test("login: rejects an account with no password hash set", async () => {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: crypto.randomUUID(),
    householdId,
    name: "No Password",
    role: "admin",
    email: "no-pass@example.com",
    passwordHash: null,
  });

  const result = await login(
    null,
    formData({ email: "no-pass@example.com", password: "password123" }),
  );
  assert.deepEqual(result, { error: "Invalid email or password." });
});

test("login: rejects the wrong password", async () => {
  const { hashSecret } = await import("@/lib/auth/password");
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: crypto.randomUUID(),
    householdId,
    name: "Jeremy",
    role: "admin",
    email: "jeremy@example.com",
    passwordHash: await hashSecret("correct-password"),
  });

  const result = await login(
    null,
    formData({ email: "jeremy@example.com", password: "wrong-password" }),
  );
  assert.deepEqual(result, { error: "Invalid email or password." });
});

test("login: succeeds with the correct password and redirects home", async () => {
  const { hashSecret } = await import("@/lib/auth/password");
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: userId,
    householdId,
    name: "Jeremy",
    role: "admin",
    email: "jeremy@example.com",
    passwordHash: await hashSecret("correct-password"),
  });

  await assert.rejects(
    login(
      null,
      formData({ email: "jeremy@example.com", password: "correct-password" }),
    ),
    /NEXT_REDIRECT:\//,
  );

  assert.equal((await getSession())?.householdId, householdId);
  assert.equal((await getProfileSession())?.userId, userId);
});

test("logout: clears the session and redirects to /login", async () => {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  const { createSession } = await import("@/lib/auth/session");
  await createSession(householdId);

  await assert.rejects(logout(), /NEXT_REDIRECT:\/login/);
  assert.equal(await getSession(), null);
});

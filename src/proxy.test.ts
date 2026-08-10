import assert from "node:assert/strict";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { test } from "vitest";
import { proxy } from "./proxy.ts";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);

async function signToken(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(SECRET);
}

function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: {
      pathname,
      clone: () => new URL(url),
    },
    cookies: {
      get: (name: string) =>
        name in cookies ? { name, value: cookies[name] } : undefined,
    },
    // Minimal NextRequest stand-in — proxy() only touches nextUrl/cookies.
  } as unknown as NextRequest;
}

test("proxy: allows public paths through with no session", async () => {
  const response = await proxy(makeRequest("/login"));
  assert.equal(response.status, 200);
});

test("proxy: redirects to /login with no session cookie", async () => {
  const response = await proxy(makeRequest("/chores"));
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/login$/);
});

test("proxy: redirects to /login with a malformed session cookie", async () => {
  const response = await proxy(
    makeRequest("/chores", { hestia_session: "not-a-real-jwt" }),
  );
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/login$/);
});

test("proxy: allows /switch-profile through with only a session cookie", async () => {
  const token = await signToken({ householdId: "h1" });
  const response = await proxy(
    makeRequest("/switch-profile", { hestia_session: token }),
  );
  assert.equal(response.status, 200);
});

test("proxy: redirects to /switch-profile with a session but no profile", async () => {
  const token = await signToken({ householdId: "h1" });
  const response = await proxy(makeRequest("/chores", { hestia_session: token }));
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /\/switch-profile$/);
});

test("proxy: allows the request through with a valid session and profile", async () => {
  const token = await signToken({ householdId: "h1" });
  const profile = await signToken({ householdId: "h1", userId: "u1" });
  const response = await proxy(
    makeRequest("/chores", { hestia_session: token, hestia_profile: profile }),
  );
  assert.equal(response.status, 200);
});

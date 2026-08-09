import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "hestia_session";
const PROFILE_COOKIE = "hestia_profile";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

type SessionPayload = { householdId: string };
type ProfilePayload = { householdId: string; userId: string };

async function sign(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as T;
  } catch {
    return null;
  }
}

export async function createSession(householdId: string) {
  const token = await sign({ householdId });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verify<SessionPayload>(store.get(SESSION_COOKIE)?.value);
}

export async function createProfileSession(
  householdId: string,
  userId: string,
) {
  const token = await sign({ householdId, userId });
  const store = await cookies();
  store.set(PROFILE_COOKIE, token, cookieOptions);
}

export async function getProfileSession(): Promise<ProfilePayload | null> {
  const store = await cookies();
  return verify<ProfilePayload>(store.get(PROFILE_COOKIE)?.value);
}

export async function clearProfileSession() {
  const store = await cookies();
  store.delete(PROFILE_COOKIE);
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(PROFILE_COOKIE);
}

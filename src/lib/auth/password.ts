import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// Shared by both the household password and per-profile PINs — a PIN is
// just a short secret, no reason to hash it more weakly.
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(secret, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;

  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = (await scryptAsync(secret, salt, KEY_LENGTH)) as Buffer;
  if (derivedKey.length !== keyBuffer.length) return false;

  return timingSafeEqual(derivedKey, keyBuffer);
}

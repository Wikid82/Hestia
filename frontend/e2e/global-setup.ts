import { request } from "@playwright/test";
import type { FullConfig } from "@playwright/test";

// Runs once before every spec. Creates (or reuses) the instance's very
// first signup — the only user that ever gets IsSystemAdmin (see
// docs/current_spec.md Decision 8) — and saves its session as
// storageState for the one spec that needs system-admin access (the
// "invite a new HoH" admin flow). Every other spec signs up its own fresh
// household through the real UI instead, so it doesn't touch this state.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "e2e-admin-password";
const ADMIN_NAME = "E2E Admin";
const ADMIN_HOUSEHOLD_NAME = "E2E Admin Household";

export const ADMIN_STORAGE_STATE = "e2e/.auth/admin.json";
export { ADMIN_EMAIL, ADMIN_PASSWORD };

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://127.0.0.1:8080";
  const context = await request.newContext({ baseURL });

  try {
    const signupResponse = await context.post("/api/auth/signup", {
      data: {
        householdName: ADMIN_HOUSEHOLD_NAME,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });

    if (!signupResponse.ok()) {
      // Most likely: a prior run already created this user (e.g. local
      // re-run without a fresh container/volume) and this instance's
      // first signup is already taken — fall back to logging in instead.
      const loginResponse = await context.post("/api/auth/login", {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      if (!loginResponse.ok()) {
        const body = await loginResponse.text();
        throw new Error(
          `e2e global-setup: signup failed (${signupResponse.status()}) and login fallback ` +
            `also failed (${loginResponse.status()}): ${body}`,
        );
      }
    }

    await context.storageState({ path: ADMIN_STORAGE_STATE });
  } finally {
    await context.dispose();
  }
}

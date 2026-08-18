import { expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

// Reads outbound invite email captured by the e2e docker-compose override's
// Mailpit service (see docs/current_spec.md Decision 9) and extracts the
// real invite token, which the API itself never returns (tokens are stored
// hashed — see backend/internal/models/models.go's Invite doc comment).
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

export async function findInviteLink(request: APIRequestContext, toEmail: string): Promise<string> {
  let messageId: string | undefined;

  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT_URL}/api/v1/messages`);
        const body = await res.json();
        const match = (body.messages as { ID: string; To: { Address: string }[] }[]).find((m) =>
          m.To.some((to) => to.Address.toLowerCase() === toEmail.toLowerCase()),
        );
        messageId = match?.ID;
        return messageId;
      },
      { message: `waiting for an invite email to ${toEmail}`, timeout: 10_000 },
    )
    .toBeTruthy();

  const messageRes = await request.get(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const message = await messageRes.json();
  const body: string = message.Text ?? message.HTML ?? "";

  const match = body.match(/\/invite\/[A-Za-z0-9_-]+/);
  if (!match) {
    throw new Error(`No /invite/:token link found in email body:\n${body}`);
  }
  return match[0];
}

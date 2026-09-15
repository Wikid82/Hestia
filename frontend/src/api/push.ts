import { api } from "./client";

export function getVAPIDPublicKey() {
  return api.get<{ publicKey: string }>("/push/vapid-public-key");
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function subscribe(input: PushSubscriptionInput) {
  return api.post<{ ok: boolean }>("/push/subscribe", input);
}

export function unsubscribe(endpoint: string) {
  return api.post<{ ok: boolean }>("/push/unsubscribe", { endpoint });
}

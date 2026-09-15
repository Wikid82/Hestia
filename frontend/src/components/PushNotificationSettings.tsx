import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getVAPIDPublicKey, subscribe, unsubscribe } from "@/api/push";
import { ApiError } from "@/api/client";

// PushManager.subscribe wants its applicationServerKey as a Uint8Array, but
// the backend hands us the VAPID public key as base64url text.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output.buffer;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return "Something went wrong";
}

// Lets the current profile opt into/out of browser Web Push (issue #39).
// Reads/writes the subscription state through the service worker
// registered in main.tsx (see frontend/public/sw.js) — that registration
// is what makes push notifications possible at all, so this renders a
// simple "not supported" message on a browser/context without it (e.g.
// no service worker support, or not installed on iOS) rather than a
// broken toggle.
export function PushNotificationSettings() {
  const supported =
    typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof window !== "undefined" && "PushManager" in window;

  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(supported);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existing) => {
        if (!cancelled) setSubscribed(!!existing);
      })
      .catch(() => {
        // Best-effort status check — leave subscribed at its default
        // (false) rather than blocking the toggle from rendering.
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enableMutation = useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const { publicKey } = await getVAPIDPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = pushSubscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }
      await subscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
    },
    onSuccess: () => {
      setSubscribed(true);
      setError(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();
      if (!pushSubscription) return;
      const endpoint = pushSubscription.endpoint;
      await pushSubscription.unsubscribe();
      await unsubscribe(endpoint);
    },
    onSuccess: () => {
      setSubscribed(false);
      setError(null);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!supported) {
    return <p className="text-sm text-muted-foreground">Push notifications aren't supported in this browser.</p>;
  }

  const pending = checking || enableMutation.isPending || disableMutation.isPending;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={subscribed}
          disabled={pending}
          onChange={(e) => {
            setError(null);
            if (e.target.checked) {
              enableMutation.mutate();
            } else {
              disableMutation.mutate();
            }
          }}
        />
        Push notifications
      </label>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

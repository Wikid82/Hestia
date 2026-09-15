import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { render } from "@testing-library/react";
import { PushNotificationSettings } from "./PushNotificationSettings";

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PushNotificationSettings />
    </QueryClientProvider>,
  );
}

class FakePushSubscription {
  endpoint: string;
  unsubscribe = vi.fn().mockResolvedValue(true);
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  toJSON() {
    return { endpoint: this.endpoint, keys: { p256dh: "test-p256dh", auth: "test-auth" } };
  }
}

function stubServiceWorker(opts: {
  existingSubscription?: FakePushSubscription | null;
  subscribeImpl?: () => Promise<FakePushSubscription>;
}) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(opts.existingSubscription ?? null),
    subscribe: vi.fn(opts.subscribeImpl ?? (() => Promise.resolve(new FakePushSubscription("https://push.example.com/new")))),
  };
  const registration = { pushManager };
  vi.stubGlobal("navigator", {
    ...navigator,
    serviceWorker: { ready: Promise.resolve(registration) },
  });
  vi.stubGlobal("PushManager", function () {});
  return { pushManager };
}

beforeEach(() => {
  vi.stubGlobal(
    "Notification",
    Object.assign(vi.fn(), { requestPermission: vi.fn().mockResolvedValue("granted") }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PushNotificationSettings", () => {
  it("shows an unsupported message when the browser lacks service worker/push support", async () => {
    renderWithQueryClient();
    expect(await screen.findByText(/aren't supported/i)).toBeInTheDocument();
  });

  it("reflects an existing subscription as checked", async () => {
    stubServiceWorker({ existingSubscription: new FakePushSubscription("https://push.example.com/existing") });
    renderWithQueryClient();
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
  });

  it("subscribes when toggled on", async () => {
    const { pushManager } = stubServiceWorker({ existingSubscription: null });
    mockApi({
      "GET /api/push/vapid-public-key": { body: { publicKey: "dGVzdC1rZXk" } },
      "POST /api/push/subscribe": { body: { ok: true } },
    });
    const user = userEvent.setup();
    renderWithQueryClient();

    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
  });

  it("shows an error when permission is denied", async () => {
    stubServiceWorker({ existingSubscription: null });
    vi.stubGlobal(
      "Notification",
      Object.assign(vi.fn(), { requestPermission: vi.fn().mockResolvedValue("denied") }),
    );
    const user = userEvent.setup();
    renderWithQueryClient();

    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    await user.click(screen.getByRole("checkbox"));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission/i);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("unsubscribes when toggled off", async () => {
    const existing = new FakePushSubscription("https://push.example.com/existing");
    stubServiceWorker({ existingSubscription: existing });
    mockApi({ "POST /api/push/unsubscribe": { body: { ok: true } } });
    const user = userEvent.setup();
    renderWithQueryClient();

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    await user.click(screen.getByRole("checkbox"));

    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    expect(existing.unsubscribe).toHaveBeenCalled();
  });
});

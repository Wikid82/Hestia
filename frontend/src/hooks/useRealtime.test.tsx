import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRealtime } from "./useRealtime";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useRealtime", () => {
  it("does not open a socket when disabled", () => {
    renderHook(() => useRealtime(false), { wrapper });
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("opens a socket to /api/ws when enabled", () => {
    renderHook(() => useRealtime(true), { wrapper });
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toContain("/api/ws");
  });

  it("invalidates chores and members caches on chore.completed", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtime(true), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
    const socket = FakeWebSocket.instances[0];
    socket.onmessage?.({ data: JSON.stringify({ type: "chore.completed" }) });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["chores"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["members"] });
  });

  it("invalidates rewards and members caches on reward.redeemed", () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useRealtime(true), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });
    const socket = FakeWebSocket.instances[0];
    socket.onmessage?.({ data: JSON.stringify({ type: "reward.redeemed" }) });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["rewards"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["members"] });
  });

  it("ignores unparseable message payloads without throwing", () => {
    renderHook(() => useRealtime(true), { wrapper });
    const socket = FakeWebSocket.instances[0];
    expect(() => socket.onmessage?.({ data: "not json" })).not.toThrow();
  });

  it("reconnects after the socket closes while still enabled", () => {
    renderHook(() => useRealtime(true), { wrapper });
    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0].close();
    vi.advanceTimersByTime(2000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("closes the socket and does not reconnect on unmount", () => {
    const { unmount } = renderHook(() => useRealtime(true), { wrapper });
    const socket = FakeWebSocket.instances[0];
    unmount();
    expect(socket.closed).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});

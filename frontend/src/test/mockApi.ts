import { vi } from "vitest";

type HandlerResult = { status?: number; body?: unknown };
type Handler = (url: string, init?: RequestInit) => HandlerResult | Promise<HandlerResult>;

// Minimal route-keyed fetch mock ("METHOD /api/path" -> canned response) —
// enough for this app's needs without pulling in a dependency like MSW.
// Unmatched requests throw immediately with a clear message rather than
// hanging or returning undefined, so a missing handler fails fast.
export function mockApi(handlers: Record<string, Handler | HandlerResult>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const key = `${method} ${path}`;

    const handler = handlers[key];
    if (!handler) {
      throw new Error(`mockApi: no handler registered for "${key}"`);
    }
    const result = typeof handler === "function" ? await handler(url, init) : handler;
    const status = result.status ?? 200;

    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      json: async () => result.body,
      text: async () => (result.body === undefined ? "" : JSON.stringify(result.body)),
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

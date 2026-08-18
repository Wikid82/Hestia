import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./client";

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "",
    json: async () => ({}),
    ...response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GET requests hit /api<path> with credentials included", async () => {
    const fetchMock = mockFetch({ text: async () => '{"ok":true}' });
    const result = await api.get<{ ok: boolean }>("/household");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/household",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("POST requests send a JSON body with the Content-Type header set", async () => {
    const fetchMock = mockFetch({ text: async () => '{"id":"1"}' });
    await api.post("/members", { name: "Kid" });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Kid" }));
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("POST with no body omits the body and Content-Type header", async () => {
    const fetchMock = mockFetch({ text: async () => "" });
    await api.post("/profiles/to-picker");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
  });

  it("a 204 response returns undefined without reading the body", async () => {
    const textFn = vi.fn().mockResolvedValue("");
    mockFetch({ status: 204, text: textFn });
    const result = await api.delete("/members/1");

    expect(result).toBeUndefined();
  });

  it("an empty non-204 body returns undefined", async () => {
    mockFetch({ text: async () => "" });
    const result = await api.get("/something");
    expect(result).toBeUndefined();
  });

  it("a non-ok response with a JSON error body throws ApiError with that message", async () => {
    mockFetch({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({ error: "an account with that email already exists" }),
    });

    await expect(api.post("/auth/signup", {})).rejects.toMatchObject({
      status: 409,
      message: "an account with that email already exists",
    });
  });

  it("a non-ok response with a non-JSON body falls back to statusText", async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });

    await expect(api.get("/broken")).rejects.toMatchObject({
      status: 500,
      message: "Internal Server Error",
    });
  });

  it("ApiError is an instance of Error and carries the status code", async () => {
    mockFetch({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) });

    try {
      await api.get("/missing");
      expect.unreachable("expected api.get to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toBeInstanceOf(Error);
      expect((err as ApiError).status).toBe(404);
    }
  });
});

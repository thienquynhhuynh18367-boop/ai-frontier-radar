import { describe, expect, it, vi } from "vitest";
import { FetchHttpClient, HttpError } from "../lib/http-client";

const url = "https://example.com/items";

function fakeFetch(responses: Response[]): typeof fetch {
  return vi.fn(async () => {
    const response = responses.shift();
    if (!response) throw new Error("Unexpected extra request");
    return response;
  }) as typeof fetch;
}

function fakeSleep() {
  return vi.fn(async (delayMs: number) => {
    expect(delayMs).toBeGreaterThanOrEqual(0);
  });
}

describe("FetchHttpClient", () => {
  it("returns raw response text and a consistent User-Agent", async () => {
    const fetchImpl = fakeFetch([new Response("<feed>item</feed>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    })]);
    const response = await new FetchHttpClient({ fetchImpl }).get(url);
    expect(response).toEqual({
      status: 200,
      ok: true,
      headers: { "content-type": "application/xml" },
      body: "<feed>item</feed>",
    });
    const request = vi.mocked(fetchImpl).mock.calls[0][1];
    expect(request?.method).toBe("GET");
    expect(new Headers(request?.headers).get("user-agent")).toBe("ai-frontier-radar/0.1");
  });

  it("recognizes timeout and stops after three retries", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    const sleep = fakeSleep();
    const client = new FetchHttpClient({ fetchImpl, sleep });
    await expect(client.get(url, { timeoutMs: 2 })).rejects.toMatchObject({
      code: "timeout", attempts: 4, retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([5_000, 10_000, 30_000]);
  });

  it("retries HTTP 500 and returns the later successful response", async () => {
    const fetchImpl = fakeFetch([new Response("error", { status: 500 }), new Response("ok", { status: 200 })]);
    const sleep = fakeSleep();
    const result = await new FetchHttpClient({ fetchImpl, sleep }).get(url);
    expect(result.body).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5_000);
  });

  it.each([400, 401, 403, 404, 501])("does not retry HTTP %i", async (status) => {
    const fetchImpl = fakeFetch([new Response("error", { status })]);
    const sleep = fakeSleep();
    await expect(new FetchHttpClient({ fetchImpl, sleep }).get(url)).rejects.toMatchObject({
      status, attempts: 1, retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries HTTP 429 and respects Retry-After seconds", async () => {
    const fetchImpl = fakeFetch([
      new Response("slow down", { status: 429, headers: { "Retry-After": "2" } }),
      new Response("ok", { status: 200 }),
    ]);
    const sleep = fakeSleep();
    expect((await new FetchHttpClient({ fetchImpl, sleep }).get(url)).body).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("respects an HTTP-date Retry-After using an injected clock", async () => {
    const now = Date.UTC(2026, 9, 13, 8, 30, 0);
    const fetchImpl = fakeFetch([
      new Response("slow down", { status: 429, headers: { "Retry-After": new Date(now + 7_000).toUTCString() } }),
      new Response("ok", { status: 200 }),
    ]);
    const sleep = fakeSleep();
    await new FetchHttpClient({ fetchImpl, sleep, now: () => now }).get(url);
    expect(sleep).toHaveBeenCalledWith(7_000);
  });

  it("stops when Retry-After exceeds the maximum wait", async () => {
    const fetchImpl = fakeFetch([new Response("slow down", { status: 429, headers: { "Retry-After": "120" } })]);
    const sleep = fakeSleep();
    await expect(new FetchHttpClient({ fetchImpl, sleep }).get(url)).rejects.toMatchObject({
      code: "rate_limited", status: 429, attempts: 1, retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops after the configured three HTTP retries", async () => {
    const fetchImpl = fakeFetch(Array.from({ length: 4 }, () => new Response("error", { status: 503 })));
    const sleep = fakeSleep();
    await expect(new FetchHttpClient({ fetchImpl, sleep }).get(url)).rejects.toMatchObject({
      code: "server_error", status: 503, attempts: 4, retryable: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([5_000, 10_000, 30_000]);
  });

  it("wraps network exceptions without retrying or exposing Authorization", async () => {
    const secret = "very-secret-token";
    const fetchImpl = vi.fn(async () => { throw new Error(`Bearer ${secret}`); }) as typeof fetch;
    const sleep = fakeSleep();
    let caught: unknown;
    try {
      await new FetchHttpClient({ fetchImpl, sleep }).get(`${url}?token=${secret}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({ code: "network", attempts: 1, retryable: false, url: "https://example.com" });
    expect(JSON.stringify(caught)).not.toContain(secret);
    expect((caught as Error).message).not.toContain(secret);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("rejects unsupported URLs before any request", async () => {
    const fetchImpl = fakeFetch([]);
    await expect(new FetchHttpClient({ fetchImpl }).get("ftp://example.com/item")).rejects.toMatchObject({
      code: "invalid_response", attempts: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import type { HttpClient, HttpErrorCode, HttpRequestOptions, HttpResponse } from "../types/http";

const USER_AGENT = "ai-frontier-radar/0.1";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TIMEOUT_MS = 30_000;
const RETRY_DELAYS_MS = [5_000, 10_000, 30_000] as const;
const MAX_RETRY_AFTER_MS = 60_000;

const errorMessages: Record<HttpErrorCode, string> = {
  timeout: "HTTP request timed out",
  network: "HTTP network request failed",
  rate_limited: "HTTP request was rate limited",
  client_error: "HTTP client error response",
  server_error: "HTTP server error response",
  invalid_response: "Invalid HTTP request or response",
};

export class HttpError extends Error {
  readonly name = "HttpError";
  readonly code: HttpErrorCode;
  readonly url: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly attempts: number;

  constructor(code: HttpErrorCode, url: string, attempts: number, retryable: boolean, status?: number) {
    // 不拼接原始异常、请求 Header 或 URL query，避免 Token 出现在日志和错误序列化中。
    super(errorMessages[code]);
    this.code = code;
    this.url = url;
    this.status = status;
    this.retryable = retryable;
    this.attempts = attempts;
  }
}

type HttpClientDependencies = {
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (delayMs: number) => Promise<void>;
  readonly now?: () => number;
};

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "<invalid-url>";
  }
}

function retryAfterMs(value: string, now: number): number | null {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1_000;
  }
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function statusError(status: number, url: string, attempt: number): HttpError {
  if (status === 429) return new HttpError("rate_limited", url, attempt, true, status);
  if ([500, 502, 503, 504].includes(status)) return new HttpError("server_error", url, attempt, true, status);
  if (status >= 400 && status < 500) return new HttpError("client_error", url, attempt, false, status);
  if (status >= 500 && status < 600) return new HttpError("server_error", url, attempt, false, status);
  return new HttpError("invalid_response", url, attempt, false, status);
}

export class FetchHttpClient implements HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private readonly now: () => number;

  constructor(dependencies: HttpClientDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.sleep = dependencies.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    this.now = dependencies.now ?? Date.now;
  }

  async get(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const errorUrl = safeOrigin(url);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new HttpError("invalid_response", errorUrl, 0, false);
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      throw new HttpError("invalid_response", errorUrl, 0, false);
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
      throw new HttpError("invalid_response", errorUrl, 0, false);
    }

    let headers: Headers;
    try {
      headers = new Headers(options.headers);
      headers.set("User-Agent", USER_AGENT);
    } catch {
      throw new HttpError("invalid_response", errorUrl, 0, false);
    }

    for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
      let result: { response: Response; body: string };
      try {
        result = await this.fetchOnce(url, headers, timeoutMs, attempt, errorUrl);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        // 仅超时可重试；网络异常不自动重放，避免未知副作用和额外请求。
        if (error.code === "timeout" && attempt <= RETRY_DELAYS_MS.length) {
          await this.sleep(RETRY_DELAYS_MS[attempt - 1]);
          continue;
        }
        throw error;
      }

      const { response, body } = result;
      if (response.ok) {
        return {
          status: response.status,
          ok: true,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        };
      }

      const error = statusError(response.status, errorUrl, attempt);
      if (!error.retryable || attempt > RETRY_DELAYS_MS.length) throw error;

      let delayMs: number = RETRY_DELAYS_MS[attempt - 1];
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const requestedDelay = retryAfter === null ? null : retryAfterMs(retryAfter, this.now());
        if (requestedDelay !== null) {
          if (requestedDelay > MAX_RETRY_AFTER_MS) {
            throw new HttpError("rate_limited", errorUrl, attempt, false, response.status);
          }
          delayMs = requestedDelay;
        }
      }
      await this.sleep(delayMs);
    }

    throw new HttpError("invalid_response", errorUrl, RETRY_DELAYS_MS.length + 1, false);
  }

  private async fetchOnce(
    url: string,
    headers: Headers,
    timeoutMs: number,
    attempt: number,
    errorUrl: string,
  ): Promise<{ response: Response; body: string }> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await this.fetchImpl(url, { method: "GET", headers, signal: controller.signal });
      // 非 2xx body 不进入错误对象；成功时保持原始文本，不预设 JSON/XML/HTML 格式。
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return { response, body: "" };
      }
      return { response, body: await response.text() };
    } catch (error) {
      const aborted = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
      const code = timedOut || aborted ? "timeout" : "network";
      throw new HttpError(code, errorUrl, attempt, code === "timeout");
    } finally {
      clearTimeout(timer);
    }
  }
}

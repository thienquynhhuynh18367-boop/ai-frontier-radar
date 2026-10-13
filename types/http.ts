export type HttpRequestOptions = {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
};

export type HttpResponse = {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
};

export interface HttpClient {
  get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

export type HttpErrorCode =
  | "timeout"
  | "network"
  | "rate_limited"
  | "client_error"
  | "server_error"
  | "invalid_response";

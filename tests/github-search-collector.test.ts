import { describe, expect, it } from "vitest";
import { GitHubSearchCollector, type GitHubSearchCollectorOptions } from "../collectors/github";
import { githubSearchQueries, githubSearchRequestConfig } from "../config/sources/github-search";
import { HttpError } from "../lib/http-client";
import type { CollectorContext } from "../types/collector";
import type { HttpRequestOptions, HttpResponse } from "../types/http";
import { githubRepository, githubResponse, invalidGitHubRepository } from "./fixtures/github-search-response";

const fixedTime = "2026-10-13T09:00:00.000Z";
const mcpQuery = { id: "mcp", query: "topic:mcp" };
const agentQuery = { id: "agent", query: "topic:agent" };

type Request = { url: string; options?: HttpRequestOptions };

function setup(
  response: (url: URL, options?: HttpRequestOptions) => Promise<HttpResponse> | HttpResponse,
  options: GitHubSearchCollectorOptions = {},
  window: Pick<CollectorContext, "windowStart" | "windowEnd"> = {
    windowStart: "2026-10-12T00:00:00.000Z",
    windowEnd: "2026-10-13T00:00:00.000Z",
  },
) {
  const requests: Request[] = [];
  const context: CollectorContext = {
    asOf: fixedTime,
    ...window,
    cursor: null,
    http: {
      get: async (url, requestOptions) => {
        requests.push({ url, options: requestOptions });
        return response(new URL(url), requestOptions);
      },
    },
  };
  const collector = new GitHubSearchCollector({ queries: [mcpQuery], now: () => fixedTime, ...options });
  return { collector, context, requests };
}

function ok(items: readonly unknown[] = [], incomplete = false, totalCount = items.length): HttpResponse {
  return { status: 200, ok: true, headers: {}, body: githubResponse(items, incomplete, totalCount) };
}

function repo(id: number, pushedAt = "2026-10-12T13:00:00Z") {
  return { ...githubRepository, id, name: `repo-${id}`, full_name: `sample/repo-${id}`,
    html_url: `https://github.com/sample/repo-${id}`, pushed_at: pushedAt };
}

describe("GitHub Search query registry", () => {
  it("defines the eight distinct narrow topics with valid IDs and no machine-learning query", () => {
    const expectedIds = ["ai-agent", "agent", "rag", "mcp", "ai-coding", "llm", "large-language-model", "enterprise-ai"];
    expect(githubSearchQueries.map(({ id }) => id)).toEqual(expectedIds);
    expect(new Set(githubSearchQueries.map(({ id }) => id)).size).toBe(expectedIds.length);
    for (const { id, query } of githubSearchQueries) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(query).toBe(`topic:${id}`);
      expect(query.trim()).not.toBe("");
      expect(query).not.toContain("machine-learning");
    }
    expect(githubSearchRequestConfig).toEqual({ perPage: 50, maxPagesPerQuery: 1, sort: "updated", order: "desc" });
  });
});

describe("GitHubSearchCollector requests", () => {
  it("runs all eight configured queries by default", async () => {
    const requests: string[] = [];
    const context: CollectorContext = {
      asOf: fixedTime,
      windowStart: "2026-10-12T00:00:00.000Z",
      windowEnd: "2026-10-13T00:00:00.000Z",
      cursor: null,
      http: { get: async (url) => { requests.push(url); return ok(); } },
    };
    const result = await new GitHubSearchCollector({ now: () => fixedTime }).collect(context);
    expect(result.status).toBe("success");
    expect(requests).toHaveLength(githubSearchQueries.length);
    expect(requests.map((url) => new URL(url).searchParams.get("q")?.split(" ")[0]))
      .toEqual(githubSearchQueries.map(({ query }) => query));
  });

  it("uses the encoded REST URL, qualifiers, version, anonymous headers, and default page limit", async () => {
    const { collector, context, requests } = setup(() => ok([githubRepository]));
    const result = await collector.collect(context);
    expect(result.status).toBe("success");
    expect(requests).toHaveLength(1);
    const request = requests[0];
    const url = new URL(request.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://api.github.com/search/repositories");
    expect(request.url).toContain("q=topic%3Amcp+");
    expect(url.searchParams.get("q")).toBe("topic:mcp is:public archived:false fork:false pushed:2026-10-12..2026-10-13");
    expect(url.searchParams.get("sort")).toBe("updated");
    expect(url.searchParams.get("order")).toBe("desc");
    expect(url.searchParams.get("per_page")).toBe("50");
    expect(url.searchParams.get("page")).toBe("1");
    expect(request.options?.headers).toMatchObject({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
    });
    expect(request.options?.headers).not.toHaveProperty("Authorization");
  });

  it("passes an optional Bearer token only in the header and never in the result or URL", async () => {
    const token = "secret-for-offline-test";
    const { collector, context, requests } = setup(() => ok([githubRepository]), { token });
    const result = await collector.collect(context);
    expect(requests[0].options?.headers?.Authorization).toBe(`Bearer ${token}`);
    expect(requests[0].url).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result.errors)).not.toContain(token);
  });

  it("uses dates from each context and a configurable next page without changing production defaults", async () => {
    const { collector, context, requests } = setup(
      (url) => ok(url.searchParams.get("page") === "1" ? [repo(1), repo(2)] : [repo(3)], false, 3),
      { perPage: 2, maxPagesPerQuery: 2 },
      { windowStart: "2026-10-11T12:00:00.000Z", windowEnd: "2026-10-14T12:00:00.000Z" },
    );
    const result = await collector.collect(context);
    expect(requests.map(({ url }) => new URL(url).searchParams.get("page"))).toEqual(["1", "2"]);
    expect(requests.map(({ url }) => new URL(url).searchParams.get("per_page"))).toEqual(["2", "2"]);
    expect(new URL(requests[0].url).searchParams.get("q")).toContain("pushed:2026-10-11..2026-10-14");
    expect(result.receivedCount).toBe(3);
    expect(result.acceptedCount).toBe(3);
  });

  it("stops paging when a page is shorter than perPage", async () => {
    const { collector, context, requests } = setup(() => ok([githubRepository], false, 500),
      { perPage: 2, maxPagesPerQuery: 3 });
    expect((await collector.collect(context)).status).toBe("success");
    expect(requests).toHaveLength(1);
  });
});

describe("GitHubSearchCollector mapping and filtering", () => {
  it("maps only source-native minimal fields and preserves nullable description and language", async () => {
    const { collector, context } = setup(() => ok([{ ...githubRepository, description: null, language: null }]));
    const result = await collector.collect(context);
    expect(result).toMatchObject({ collectorId: "github-search", status: "success", receivedCount: 1,
      acceptedCount: 1, nextCursor: null, startedAt: fixedTime, finishedAt: fixedTime });
    expect(result.items[0]).toEqual({
      source: "github", sourceType: "api", externalId: "123", url: githubRepository.html_url,
      collectedAt: fixedTime,
      data: {
        id: 123, name: githubRepository.name, full_name: githubRepository.full_name,
        html_url: githubRepository.html_url, description: null, owner: { login: "sample" },
        stargazers_count: 42, forks_count: 7, open_issues_count: 3, language: null,
        topics: ["mcp", "agent"], created_at: githubRepository.created_at,
        updated_at: githubRepository.updated_at, pushed_at: githubRepository.pushed_at,
        archived: false, fork: false, private: false, default_branch: "main",
        matched_query_ids: ["mcp"],
      },
    });
    expect(JSON.stringify(result)).not.toContain("events_url");
  });

  it("accepts start and interior timestamps, excludes end and timestamps outside the half-open window", async () => {
    const rows = [
      repo(1, "2026-10-12T00:00:00Z"),
      repo(2, "2026-10-12T12:00:00Z"),
      repo(3, "2026-10-13T00:00:00Z"),
      repo(4, "2026-10-11T23:59:59Z"),
      repo(5, "2026-10-13T00:00:01Z"),
      repo(6, "2026-10-12T12:00:00.123Z"),
    ];
    const { collector, context } = setup(() => ok(rows));
    const result = await collector.collect(context);
    expect(result.items.map((item) => item.externalId)).toEqual(["1", "2", "6"]);
    expect(result.items.find((item) => item.externalId === "6")?.data.pushed_at).toBe("2026-10-12T12:00:00.123Z");
    expect(result.receivedCount).toBe(6);
    expect(result.acceptedCount).toBe(3);
  });

  it("excludes private, archived, fork, and null pushed_at without marking an error", async () => {
    const rows = [repo(1), { ...repo(2), private: true }, { ...repo(3), archived: true },
      { ...repo(4), fork: true }, { ...repo(5), pushed_at: null }];
    const { collector, context } = setup(() => ok(rows), { token: "secret-for-offline-test" });
    const result = await collector.collect(context);
    expect(result.status).toBe("success");
    expect(result.receivedCount).toBe(5);
    expect(result.acceptedCount).toBe(1);
    expect(result.items.map((item) => item.externalId)).toEqual(["1"]);
    expect(JSON.stringify(result)).not.toContain("secret-for-offline-test");
    expect(JSON.stringify(result)).not.toContain("repo-2");
  });

  it("consolidates overlapping queries by numeric ID and sorts query evidence and output", async () => {
    const { collector, context } = setup(
      (url) => ok(url.searchParams.get("q")?.startsWith("topic:agent")
        ? [repo(20), { ...repo(3), full_name: "new-owner/renamed-repo" }]
        : [repo(3), repo(10)]),
      { queries: [mcpQuery, agentQuery] },
    );
    const result = await collector.collect(context);
    expect(result.status).toBe("success");
    expect(result.receivedCount).toBe(4);
    expect(result.acceptedCount).toBe(3);
    expect(result.items.map((item) => item.externalId)).toEqual(["10", "20", "3"]);
    expect(result.items.find((item) => item.externalId === "3")?.data.matched_query_ids).toEqual(["agent", "mcp"]);
  });

  it("keeps receivedCount separate from unique acceptedCount", async () => {
    const { collector, context } = setup(
      (url) => ok(url.searchParams.get("q")?.startsWith("topic:agent")
        ? [repo(3), repo(4, "2026-10-13T00:00:00Z")]
        : [repo(1), repo(2), repo(3)]),
      { queries: [mcpQuery, agentQuery] },
    );
    const result = await collector.collect(context);
    expect(result.receivedCount).toBe(5);
    expect(result.acceptedCount).toBe(3);
    expect(result.items).toHaveLength(3);
  });
});

describe("GitHubSearchCollector status and safe errors", () => {
  it("keeps 49 valid repositories when one of 50 items fails validation", async () => {
    const rows = [...Array.from({ length: 49 }, (_, index) => repo(index + 1)), invalidGitHubRepository];
    const { collector, context } = setup(() => ok(rows));
    const result = await collector.collect(context);
    expect(result.status).toBe("partial");
    expect(result.receivedCount).toBe(50);
    expect(result.acceptedCount).toBe(49);
    expect(result.errors).toEqual([{
      code: "github-repository-invalid", message: "GitHub Search query mcp page 1 contained 1 invalid repository items",
      retryable: false,
    }]);
    expect(JSON.stringify(result)).not.toContain("not-an-id");
  });

  it("marks an invalid GitHub timestamp as one bad repository, without discarding its neighbor", async () => {
    const { collector, context } = setup(() => ok([githubRepository,
      { ...repo(2), pushed_at: "2026-02-30T08:30:00Z" }]));
    const result = await collector.collect(context);
    expect(result.status).toBe("partial");
    expect(result.receivedCount).toBe(2);
    expect(result.acceptedCount).toBe(1);
    expect(result.errors[0].code).toBe("github-repository-invalid");
  });

  it("keeps returned data but marks incomplete_results as partial", async () => {
    const { collector, context } = setup(() => ok([githubRepository], true, 500));
    const result = await collector.collect(context);
    expect(result.status).toBe("partial");
    expect(result.acceptedCount).toBe(1);
    expect(result.errors[0].code).toBe("github-search-incomplete");
  });

  it("treats total_count above the configured page as successful signal sampling", async () => {
    const { collector, context, requests } = setup(() => ok([githubRepository], false, 5000));
    const result = await collector.collect(context);
    expect(result.status).toBe("success");
    expect(result.receivedCount).toBe(1);
    expect(requests).toHaveLength(1);
  });

  it.each([
    { body: "not-json", code: "github-search-invalid-json" },
    { body: JSON.stringify({ total_count: 1, items: [] }), code: "github-search-invalid-response" },
  ])("isolates a bad response as $code while other queries succeed", async ({ body, code }) => {
    const { collector, context } = setup((url) => ({ status: 200, ok: true, headers: {},
      body: url.searchParams.get("q")?.startsWith("topic:mcp") ? body : githubResponse([githubRepository]) }),
    { queries: [mcpQuery, agentQuery] });
    const result = await collector.collect(context);
    expect(result.status).toBe("partial");
    expect(result.receivedCount).toBe(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.errors[0].code).toBe(code);
    expect(JSON.stringify(result)).not.toContain("not-json");
  });

  it("returns failed for an invalid JSON response when no query succeeds", async () => {
    const { collector, context } = setup(() => ({ status: 200, ok: true, headers: {}, body: "not-json" }));
    const result = await collector.collect(context);
    expect(result).toMatchObject({ status: "failed", items: [], receivedCount: 0,
      acceptedCount: 0, nextCursor: null });
    expect(result.errors[0].code).toBe("github-search-invalid-json");
  });

  it("maps a safe HttpError, retains prior data, and stops requests after an explicit rate limit", async () => {
    const token = "secret-for-offline-test";
    const { collector, context, requests } = setup((url) => {
      if (url.searchParams.get("q")?.startsWith("topic:mcp")) {
        throw new HttpError("rate_limited", `https://api.github.com/search/repositories?q=${token}`, 1, false, 403,
          { retryAfterMs: 120000, rateLimitResetAt: "2026-10-13T09:02:00.000Z" });
      }
      return ok([githubRepository]);
    }, { token, queries: [agentQuery, mcpQuery, { id: "rag", query: "topic:rag" }] });
    const result = await collector.collect(context);
    expect(result.status).toBe("partial");
    expect(result.acceptedCount).toBe(1);
    expect(result.errors[0]).toMatchObject({ code: "rate_limited", url: "https://api.github.com", retryable: false });
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("rateLimitResetAt");
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("continues other queries after one ordinary HTTP failure", async () => {
    const { collector, context, requests } = setup((url) => {
      if (url.searchParams.get("q")?.startsWith("topic:mcp")) {
        throw new HttpError("server_error", "https://api.github.com", 4, true, 503);
      }
      return ok([githubRepository]);
    }, { queries: [mcpQuery, agentQuery] });
    const result = await collector.collect(context);
    expect(requests).toHaveLength(2);
    expect(result.status).toBe("partial");
    expect(result.receivedCount).toBe(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.errors[0].code).toBe("server_error");
  });

  it("returns failed with no items when every query fails, without serializing unknown error text", async () => {
    const token = "secret-for-offline-test";
    const { collector, context } = setup(() => { throw new Error(`failed with ${token}`); },
      { token, queries: [mcpQuery, agentQuery] });
    const result = await collector.collect(context);
    expect(result.status).toBe("failed");
    expect(result.items).toEqual([]);
    expect(result.receivedCount).toBe(0);
    expect(result.acceptedCount).toBe(0);
    expect(result.nextCursor).toBeNull();
    expect(result.errors).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it("distinguishes a successful empty window from failures", async () => {
    const { collector, context } = setup(() => ok([]), { queries: [mcpQuery, agentQuery] });
    const result = await collector.collect(context);
    expect(result).toMatchObject({ status: "success", items: [], receivedCount: 0,
      acceptedCount: 0, nextCursor: null, errors: [] });
  });

  it("returns the same entire result for equal context and responses with a fixed clock", async () => {
    const { collector, context } = setup(() => ok([repo(2), repo(1)]));
    expect(await collector.collect(context)).toEqual(await collector.collect(context));
  });
});

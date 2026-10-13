import { describe, expect, it } from "vitest";
import { GitHubSearchCollector } from "../collectors/github";
import {
  GitHubNormalizationError,
  normalizeGitHubRawItem,
  normalizeGitHubRawItems,
  safeNormalizeGitHubRawItem,
} from "../pipeline/normalize";
import { NormalizedItemSchema } from "../types/normalized-item";
import { validGitHubRawItem } from "./fixtures/github-normalize";
import { githubRepository, githubResponse } from "./fixtures/github-search-response";

function withData(changes: Record<string, unknown>) {
  return { ...validGitHubRawItem, data: { ...validGitHubRawItem.data, ...changes } };
}

function issueFields(input: unknown): string[] {
  const result = safeNormalizeGitHubRawItem(input);
  return result.success ? [] : result.issues.map(({ field }) => field);
}

describe("NormalizedItem contract and GitHub mapping", () => {
  it("maps a valid RawItem to an independently valid intermediate item with no invented business fields", () => {
    const item = normalizeGitHubRawItem(validGitHubRawItem);
    expect(NormalizedItemSchema.parse(item)).toEqual(item);
    expect(item).toEqual({
      schemaVersion: 1,
      id: "github-repo:123",
      title: "sample/radar-example",
      url: githubRepository.html_url,
      canonicalUrl: githubRepository.html_url,
      source: "github",
      sourceType: "api",
      sourceRefs: [{ source: "github", externalId: "123", url: githubRepository.html_url }],
      contentType: "repository",
      publishedAt: null,
      firstSeenAt: validGitHubRawItem.collectedAt,
      collectedAt: validGitHubRawItem.collectedAt,
      metadata: {
        description: "A sample AI repository",
        repositoryId: "123",
        fullName: "sample/radar-example",
        owner: "sample",
        stars: 42,
        forks: 7,
        openIssues: 3,
        language: "TypeScript",
        githubTopics: ["agent", "mcp"],
        createdAt: "2026-01-02T03:04:05.000Z",
        updatedAt: "2026-10-12T13:00:00.000Z",
        lastPushedAt: "2026-10-12T13:00:00.000Z",
        defaultBranch: "main",
        matchedQueryIds: ["agent", "mcp"],
      },
    });
    for (const field of ["topics", "companies", "popularityScore", "personalScore", "scoreBreakdown"]) {
      expect(item).not.toHaveProperty(field);
      expect(NormalizedItemSchema.safeParse({ ...item, [field]: 0 }).success).toBe(false);
    }
  });

  it("accepts nullable description, language, and pushed_at without inventing values", () => {
    const item = normalizeGitHubRawItem(withData({ description: null, language: null, pushed_at: null }));
    expect(item.publishedAt).toBeNull();
    expect(item.metadata).toMatchObject({ description: null, language: null, lastPushedAt: null });
  });

  it("keeps zero stars as a valid numeric observation", () => {
    const item = normalizeGitHubRawItem(withData({ stargazers_count: 0 }));
    expect(item.metadata.stars).toBe(0);
  });

  it("converts source times to UTC milliseconds without confusing their meanings", () => {
    const item = normalizeGitHubRawItem(withData({
      created_at: "2026-01-02T11:04:05+08:00",
      updated_at: "2026-10-12T21:00:00+08:00",
      pushed_at: "2026-10-12T21:00:01+08:00",
    }));
    expect(item.metadata).toMatchObject({
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-10-12T13:00:00.000Z",
      lastPushedAt: "2026-10-12T13:00:01.000Z",
    });
    expect(item.publishedAt).toBeNull();
    expect(item.collectedAt).toBe(validGitHubRawItem.collectedAt);
  });

  it("keeps a numeric-ID identity across rename, transfer, and later observations", () => {
    const dayOne = normalizeGitHubRawItem(validGitHubRawItem);
    const dayTwoRaw = {
      ...withData({
        name: "renamed",
        full_name: "new-owner/renamed",
        html_url: "https://github.com/new-owner/renamed",
        owner: { login: "new-owner" },
        stargazers_count: 99,
        pushed_at: "2026-10-14T13:00:00Z",
      }),
      url: "https://github.com/new-owner/renamed",
      collectedAt: "2026-10-15T09:00:00.000Z",
    };
    const dayTwo = normalizeGitHubRawItem(dayTwoRaw, { firstSeenAt: dayOne.firstSeenAt });
    expect(dayTwo.id).toBe(dayOne.id);
    expect(dayTwo.title).toBe("new-owner/renamed");
    expect(dayTwo.metadata.stars).toBe(99);
    expect(dayTwo.metadata.lastPushedAt).toBe("2026-10-14T13:00:00.000Z");
    expect(dayTwo.firstSeenAt).toBe(dayOne.firstSeenAt);
    expect(dayTwo.collectedAt).not.toBe(dayOne.collectedAt);
  });

  it("uses raw collectedAt as firstSeenAt initially and accepts an earlier historical value", () => {
    expect(normalizeGitHubRawItem(validGitHubRawItem).firstSeenAt).toBe(validGitHubRawItem.collectedAt);
    expect(normalizeGitHubRawItem(validGitHubRawItem,
      { firstSeenAt: "2026-10-10T08:00:00.000Z" }).firstSeenAt).toBe("2026-10-10T08:00:00.000Z");
  });

  it("sorts and deduplicates GitHub topics and matched query evidence", () => {
    const item = normalizeGitHubRawItem(withData({ topics: ["mcp", "agent", "mcp"],
      matched_query_ids: ["mcp", "agent", "mcp"] }));
    expect(item.metadata.githubTopics).toEqual(["agent", "mcp"]);
    expect(item.metadata.matchedQueryIds).toEqual(["agent", "mcp"]);
  });

  it("keeps metadata JSON-safe and drops unused API fields", () => {
    const item = normalizeGitHubRawItem(withData({ events_url: "https://example.com/unneeded" }));
    expect(JSON.parse(JSON.stringify(item.metadata))).toEqual(item.metadata);
    expect(JSON.stringify(item)).not.toContain("events_url");
    expect(JSON.stringify(item)).not.toContain("private");
  });
});

describe("GitHub normalization validation and safety", () => {
  it("rejects RawItem externalId that conflicts with the numeric data.id", () => {
    expect(issueFields({ ...validGitHubRawItem, externalId: "124" })).toContain("externalId");
    expect(issueFields({ ...validGitHubRawItem, externalId: "00123" })).toContain("externalId");
  });

  it.each([
    ["source", "other-source"],
    ["sourceType", "rss"],
  ])("rejects a wrong %s", (field, value) => {
    expect(issueFields({ ...validGitHubRawItem, [field]: value })).toContain(field);
  });

  it.each([
    ["private", true],
    ["archived", true],
    ["fork", true],
  ])("rejects a %s repository", (field, value) => {
    expect(issueFields(withData({ [field]: value }))).toContain(`data.${field}`);
  });

  it.each([
    ["ftp://github.com/sample/radar-example", "url"],
    ["https://github.com.evil.example/sample/radar-example", "url"],
    ["https://person:password@github.com/sample/radar-example", "url"],
    ["https://github.com/sample/radar-example/tree/main", "url"],
  ])("rejects a non-repository URL: %s", (url, field) => {
    expect(issueFields({ ...validGitHubRawItem, url })).toContain(field);
  });

  it("canonicalizes host, tracking query, fragment, and trailing slash without changing the repository path", () => {
    const url = "http://WWW.GITHUB.COM/Sample/Radar-Example/?utm_source=feed&ref=radar#readme";
    const item = normalizeGitHubRawItem({ ...validGitHubRawItem, url,
      data: { ...validGitHubRawItem.data, html_url: "https://github.com/sample/radar-example" } });
    expect(item.url).toBe(url);
    expect(item.canonicalUrl).toBe("https://github.com/Sample/Radar-Example");
    expect(item.sourceRefs[0].url).toBe(url);
  });

  it("rejects a data.html_url that points at a different repository", () => {
    expect(issueFields(withData({ html_url: "https://github.com/sample/some-other-repo" })))
      .toContain("data.html_url");
  });

  it("rejects a full_name that conflicts with owner, name, or repository URL", () => {
    expect(issueFields(withData({ full_name: "sample/another-repo" }))).toContain("data.full_name");
    expect(issueFields(withData({ owner: { login: "another-owner" } }))).toContain("data.full_name");
  });

  it("rejects missing or invalid source-specific repository fields", () => {
    expect(issueFields(withData({ stargazers_count: "42" }))).toContain("data.stargazers_count");
    expect(issueFields(withData({ id: -1 }))).toContain("data.id");
    expect(issueFields(withData({ owner: {} }))).toContain("data.owner.login");
    expect(issueFields(withData({ matched_query_ids: null }))).toContain("data.matched_query_ids");
  });

  it("rejects malformed RawItem and impossible GitHub dates", () => {
    expect(issueFields({ ...validGitHubRawItem, collectedAt: "not-a-time" })).toContain("collectedAt");
    expect(issueFields(withData({ created_at: "2026-02-30T08:30:00Z" }))).toContain("data.created_at");
  });

  it("rejects malformed or future historical firstSeenAt", () => {
    const malformed = safeNormalizeGitHubRawItem(validGitHubRawItem, { firstSeenAt: "yesterday" });
    const future = safeNormalizeGitHubRawItem(validGitHubRawItem,
      { firstSeenAt: "2026-10-14T09:00:00.000Z" });
    expect(malformed.success).toBe(false);
    expect(future.success).toBe(false);
    if (!malformed.success) expect(malformed.issues[0].field).toBe("firstSeenAt");
    if (!future.success) expect(future.issues[0].field).toBe("firstSeenAt");
  });

  it("returns only safe field errors and throws a safe error from the strict entry point", () => {
    const secret = "sensitive-input-not-to-log";
    const malformed = withData({ stargazers_count: secret });
    const result = safeNormalizeGitHubRawItem(malformed);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(() => normalizeGitHubRawItem(malformed)).toThrow(GitHubNormalizationError);
    try {
      normalizeGitHubRawItem(malformed);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(secret);
    }
  });

  it("does not expose arbitrary RawItem data keys in validation issues", () => {
    const secret = "authorization-bearer-sensitive-input";
    const result = safeNormalizeGitHubRawItem(withData({ [secret]: undefined }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    if (!result.success) expect(result.issues[0].field).toBe("data");
  });
});

describe("GitHub normalization batch and determinism", () => {
  it("isolates a bad RawItem and supports historical first-seen times in a batch", () => {
    const batch = normalizeGitHubRawItems([
      withData({ stargazers_count: "bad" }),
      validGitHubRawItem,
    ], { firstSeenAtByRepositoryId: new Map([["123", "2026-10-10T08:00:00.000Z"]]) });
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0].firstSeenAt).toBe("2026-10-10T08:00:00.000Z");
    expect(batch.errors).toEqual([{ index: 0, issues: [{ field: "data.stargazers_count", message: "Invalid field value" }] }]);
  });

  it("returns fully identical output for identical input and history", () => {
    const options = { firstSeenAt: "2026-10-10T08:00:00.000Z" };
    expect(normalizeGitHubRawItem(validGitHubRawItem, options))
      .toEqual(normalizeGitHubRawItem(validGitHubRawItem, options));
  });

  it("normalizes a T04 Collector result end to end using only fake HTTP", async () => {
    const collector = new GitHubSearchCollector({
      queries: [{ id: "mcp", query: "topic:mcp" }],
      now: () => "2026-10-13T09:00:00.000Z",
    });
    const collected = await collector.collect({
      asOf: "2026-10-13T09:00:00.000Z",
      windowStart: "2026-10-12T00:00:00.000Z",
      windowEnd: "2026-10-13T00:00:00.000Z",
      cursor: null,
      http: { get: async () => ({ status: 200, ok: true, headers: {}, body: githubResponse([githubRepository]) }) },
    });
    expect(collected.status).toBe("success");
    const batch = normalizeGitHubRawItems(collected.items);
    expect(batch.errors).toEqual([]);
    expect(batch.items).toHaveLength(1);
    expect(batch.items[0].id).toBe("github-repo:123");
    expect(batch.items[0].metadata.matchedQueryIds).toEqual(["mcp"]);
  });
});

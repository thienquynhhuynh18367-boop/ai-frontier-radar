import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HackerNewsCollector } from "../collectors/hacker-news/search";
import { ArxivCollector } from "../collectors/arxiv/search";
import { OfficialSitemapCollector } from "../collectors/official/sitemap";
import { AnthropicJobsCollector } from "../collectors/anthropic-jobs/search";
import { normalizeSourceItem } from "../pipeline/normalize/sources";
import { deduplicateItems } from "../pipeline/deduplicate";
import { classifyItem } from "../pipeline/classification";
import { rankItem } from "../pipeline/ranking";
import { processMultiSource, type SourceBatch } from "../pipeline/multi-source";
import { publishMultiSource, readFirstSeenByItemId, readLatest, recordMultiFailure } from "../lib/data-store";
import { computeTrendWindow } from "../lib/trend-data";
import { filterItems, defaultFilters } from "../lib/web-data";
import { LatestSchema } from "../types/publication";
import { CollectorResultSchema, type CollectorResult } from "../types/collector";
import { validGitHubRawItem } from "./fixtures/github-normalize";

const asOf = "2026-10-15T00:00:00.000Z";
const windowStart = "2026-10-13T16:00:00.000Z";
const windowEnd = "2026-10-14T16:00:00.000Z";
const context = (body: string) => ({ asOf, windowStart, windowEnd, cursor: null,
  http: { get: async () => ({ status: 200, ok: true, headers: {}, body }) } });
const hnRaw = { source: "hacker-news", sourceType: "api", externalId: "42",
  url: "https://news.ycombinator.com/item?id=42", collectedAt: asOf,
  data: { title: "Agent MCP launch", originalUrl: "https://openai.com/index/agent-mcp-launch/",
    discussionUrl: "https://news.ycombinator.com/item?id=42", publishedAt: "2026-10-14T09:00:00.000Z",
    points: 80, comments: 20, author: "tester", matchedQueryIds: ["mcp"], showHn: false } };
const officialRaw = { source: "openai", sourceType: "sitemap", externalId: "https://openai.com/index/agent-mcp-launch/",
  url: "https://openai.com/index/agent-mcp-launch/", collectedAt: asOf,
  data: { lastmod: "2026-10-14T09:00:00.000Z" } };
const arxivRaw = { source: "arxiv", sourceType: "api", externalId: "2610.12345",
  url: "https://arxiv.org/abs/2610.12345", collectedAt: asOf,
  data: { title: "Tool Use for Agents", summary: "A study of tool use", authors: ["A Researcher"],
    categories: ["cs.AI"], submittedAt: "2026-10-14T08:00:00.000Z", updatedAt: null } };
const jobRaw = { source: "anthropic-jobs", sourceType: "api", externalId: "12345",
  url: "https://job-boards.greenhouse.io/anthropic/jobs/12345", collectedAt: asOf,
  data: { title: "Forward Deployed Engineer", location: "London, UK", updatedAt: "2026-10-14T09:00:00.000Z" } };
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

function result(id: string, items: unknown[], status: "success" | "failed" = "success"): CollectorResult {
  return CollectorResultSchema.parse({ collectorId: id, status, items: status === "failed" ? [] : items,
    receivedCount: items.length, acceptedCount: status === "failed" ? 0 : items.length,
    nextCursor: null, startedAt: asOf, finishedAt: asOf,
    errors: status === "failed" ? [{ code: "network", message: "Source failed", retryable: false }] : [] });
}

describe("multi-source collectors and normalization", () => {
  it("HN isolates an invalid hit and preserves source ID, metrics and query evidence", async () => {
    const body = JSON.stringify({ nbPages: 1, hits: [
      { objectID: "42", title: "Agent MCP launch", url: "https://example.com/story?utm_source=x", author: "tester",
        points: 80, num_comments: 20, created_at: "2026-10-14T09:00:00.000Z", _tags: ["story"] },
      { objectID: "bad", title: "Bad", created_at: "2026-10-14T09:00:00.000Z" },
    ] });
    const collector = new HackerNewsCollector({ queries: ["MCP"], now: () => asOf });
    const collected = await collector.collect(context(body));
    expect(collected.status).toBe("success");
    expect(collected.receivedCount).toBe(2);
    expect(collected.acceptedCount).toBe(1);
    expect(collected.items[0].data.originalUrl).toBe("https://example.com/story");
    expect(normalizeSourceItem(collected.items[0]).sourceRefs[0].externalId).toBe("42");
    expect(collector.queryStats[0]).toMatchObject({ received: 2, accepted: 1, rejected: 1, requests: 1 });
  });

  it("does not collapse distinct query-dependent HN articles into one URL identity", async () => {
    const hits = ["one", "two"].map((id, index) => ({ objectID: String(index + 1), title: "MCP story",
      url: `https://example.com/story?id=${id}`, author: "tester", points: 1, num_comments: 0,
      created_at: "2026-10-14T09:00:00.000Z", _tags: ["story"] }));
    const collected = await new HackerNewsCollector({ queries: ["MCP"], now: () => asOf })
      .collect(context(JSON.stringify({ nbPages: 1, hits })));
    expect(collected.items.map((item) => item.data.originalUrl)).toEqual([null, null]);
    expect(deduplicateItems(collected.items.map((item) => normalizeSourceItem(item))).outputCount).toBe(2);
  });

  it("arXiv reads official Atom metadata, filters categories and time, rejects unsafe XML", async () => {
    const feed = `<feed><entry><id>http://arxiv.org/abs/2610.12345v1</id><title>Tool Use for Agents</title>
      <summary>A study of tool use</summary><published>2026-10-14T08:00:00Z</published><updated>2026-10-14T09:00:00Z</updated>
      <author><name>A Researcher</name></author><category term="cs.AI"/></entry></feed>`;
    const collector = new ArxivCollector({ now: () => asOf });
    const collected = await collector.collect(context(feed));
    expect(collected.status).toBe("success");
    expect(collected.acceptedCount).toBe(1);
    expect(normalizeSourceItem(collected.items[0])).toMatchObject({ id: "arxiv-paper:2610.12345", contentType: "paper",
      publishedAt: "2026-10-14T08:00:00.000Z" });
    expect((await collector.collect(context('<!DOCTYPE x [<!ENTITY x "bad">]><feed/>'))).status).toBe("failed");
  });

  it("official sitemap keeps publication time null and only accepts allowed paths", async () => {
    const collector = new OfficialSitemapCollector("anthropic", { now: () => asOf });
    const collected = await collector.collect(context(`<urlset><url><loc>https://www.anthropic.com/news/agent-launch</loc>
      <lastmod>2026-10-14T09:00:00Z</lastmod></url><url><loc>https://www.anthropic.com/careers</loc>
      <lastmod>2026-10-14T09:00:00Z</lastmod></url></urlset>`));
    expect(collected.acceptedCount).toBe(1);
    const item = normalizeSourceItem(collected.items[0]);
    expect(item.publishedAt).toBeNull();
    expect(item.metadata.lastmod).toBe("2026-10-14T09:00:00.000Z");
    expect(item.metadata.titleEvidence).toBe("url-slug");
  });

  it("officially linked job board keeps stable IDs and updated time distinct from publication", async () => {
    const body = JSON.stringify({ jobs: [
      { id: 12345, title: "Forward Deployed Engineer", updated_at: "2026-10-14T09:00:00Z",
        absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/12345?gh_src=test", location: { name: "London, UK" } },
      { id: 12346, title: "Sales Engineer", updated_at: "2026-10-14T09:00:00Z",
        absolute_url: "https://job-boards.greenhouse.io/anthropic/jobs/12346" },
    ] });
    const collector = new AnthropicJobsCollector(() => asOf);
    const collected = await collector.collect(context(body));
    expect(collected).toMatchObject({ status: "success", receivedCount: 2, acceptedCount: 1 });
    const item = normalizeSourceItem(collected.items[0]);
    expect(item).toMatchObject({ id: "anthropic-job:12345", contentType: "job", publishedAt: null,
      url: "https://job-boards.greenhouse.io/anthropic/jobs/12345" });
    expect(classifyItem(item).companies).toEqual(["anthropic"]);
    expect(classifyItem(item).topics).toContain("fde");
    expect(rankItem(classifyItem(item), asOf).scoreBreakdown.freshness).toBeGreaterThan(0);
    expect(filterItems([rankItem(classifyItem(item), asOf)], { ...defaultFilters, time: "1d", contentType: "job" }, asOf)).toHaveLength(1);
  });

  it("merges the same article URL, but never merges a repository or paper by title", () => {
    const hn = normalizeSourceItem(hnRaw);
    const official = normalizeSourceItem(officialRaw);
    const paper = normalizeSourceItem(arxivRaw);
    const merged = deduplicateItems([hn, official, paper]);
    expect(merged.outputCount).toBe(2);
    expect(merged.items.find((item) => item.id === hn.id)?.sourceRefs).toHaveLength(2);
    expect(merged.items.find((item) => item.id === hn.id)?.metadata.points).toBe(80);
    expect(merged.items.find((item) => item.id === paper.id)?.sourceRefs).toHaveLength(1);
    const ranked = rankItem(classifyItem(paper), asOf);
    expect(ranked.scoreBreakdown.freshness).toBeGreaterThan(0);
    expect(ranked.popularityScore).toBe(0);
    expect(ranked.scoreBreakdown.popularity).toBe(0);
    const officialRanked = rankItem(classifyItem(official), asOf);
    expect(officialRanked.publishedAt).toBeNull();
    expect(filterItems([officialRanked], { ...defaultFilters, time: "1d", source: "openai" }, asOf)).toHaveLength(1);
  });
});

describe("multi-source publication and trends", () => {
  it("retains HN discussion evidence when the HN source fails but the official page is seen again", () => {
    const first = processMultiSource([
      { id: "hacker-news", result: result("hacker-news", [hnRaw]) },
      { id: "openai", result: result("openai", [officialRaw]) },
    ], "2026-10-14", asOf, null, new Map());
    expect("latest" in first).toBe(true);
    if (!("latest" in first)) return;
    const second = processMultiSource([
      { id: "hacker-news", result: result("hacker-news", [], "failed") },
      { id: "openai", result: result("openai", [officialRaw]) },
    ], "2026-10-15", "2026-10-16T00:00:00.000Z", first.latest, new Map());
    expect("latest" in second).toBe(true);
    if ("latest" in second) {
      expect(second.latest.itemCount).toBe(1);
      expect(second.latest.items[0].sourceRefs.map((ref) => ref.source).sort()).toEqual(["hacker-news", "openai"]);
      expect(second.latest.sources.find((source) => source.source === "hacker-news")?.carriedCount).toBe(1);
    }
  });

  it("reads v1 history, publishes v2 once, preserves old source after failure, and excludes Raw from public", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-multi-")); roots.push(root);
    const github = { ...validGitHubRawItem, collectedAt: asOf };
    const batches: SourceBatch[] = [
      { id: "github-search", result: result("github-search", [github]) },
      { id: "hacker-news", result: result("hacker-news", [hnRaw]) },
      { id: "arxiv", result: result("arxiv", [arxivRaw]) },
      { id: "openai", result: result("openai", [officialRaw]) },
      { id: "anthropic", result: result("anthropic", []) },
      { id: "anthropic-jobs", result: result("anthropic-jobs", [jobRaw]) },
    ];
    const first = processMultiSource(batches, "2026-10-14", asOf, null, new Map());
    expect("latest" in first).toBe(true);
    if (!("latest" in first)) return;
    expect(first.latest.itemCount).toBe(4);
    expect(first.latest.duplicateCount).toBe(1);
    expect(LatestSchema.parse(first.latest).schemaVersion).toBe(2);
    await publishMultiSource(root, first.latest, new Map(batches.map((batch) => [batch.id, batch.result])));
    const before = await readFile(join(root, "public", "data", "latest.json"), "utf8");
    await publishMultiSource(root, first.latest, new Map(batches.map((batch) => [batch.id, batch.result])));
    expect(await readFile(join(root, "public", "data", "latest.json"), "utf8")).toBe(before);
    expect((await readFirstSeenByItemId(root, asOf)).size).toBe(4);
    await expect(readFile(join(root, "public", "data", "raw", "2026-10-14", "hacker-news.json"))).rejects.toThrow();
    const next = processMultiSource(batches.map((batch) => batch.id === "arxiv" ?
      { ...batch, result: result("arxiv", [], "failed") } : batch), "2026-10-15", "2026-10-16T00:00:00.000Z",
    await readLatest(root), await readFirstSeenByItemId(root, "2026-10-16T00:00:00.000Z"));
    expect("latest" in next).toBe(true);
    if ("latest" in next) {
      expect(next.latest.status).toBe("partial");
      const paper = next.latest.items.find((item) => item.contentType === "paper");
      expect(paper?.firstSeenAt).toBe(asOf);
      expect(paper?.collectedAt).toBe(asOf);
      expect(next.latest.sources.find((source) => source.source === "arxiv")?.lastSuccessAt).toBe(asOf);
    }
  });

  it("keeps latest when every source fails and rejects unsafe Raw URLs", async () => {
    const previous = processMultiSource([{ id: "hacker-news", result: result("hacker-news", [hnRaw]) }],
      "2026-10-14", asOf, null, new Map());
    expect("latest" in previous).toBe(true);
    if (!("latest" in previous)) return;
    const failed = processMultiSource([{ id: "hacker-news", result: result("hacker-news", [], "failed") }],
      "2026-10-15", "2026-10-16T00:00:00.000Z", previous.latest, new Map());
    expect(failed.status).toBe("failed");
    const root = await mkdtemp(join(tmpdir(), "radar-multi-")); roots.push(root);
    await publishMultiSource(root, previous.latest, new Map([["hacker-news", result("hacker-news", [hnRaw])]]));
    const before = await readFile(join(root, "data", "latest.json"), "utf8");
    if (!("latest" in failed)) await recordMultiFailure(root, failed.sources);
    expect(await readFile(join(root, "data", "latest.json"), "utf8")).toBe(before);
    const unsafe = { ...hnRaw, data: { ...hnRaw.data, originalUrl: "https://example.com/story?token=secret" } };
    await expect(publishMultiSource(root, previous.latest, new Map([["hacker-news", result("hacker-news", [unsafe])]])))
      .rejects.toThrow("Unsafe RawItem data fields");
  });

  it("requires identical complete source coverage for growth and uses paired Stars observations", () => {
    const paper = rankItem(classifyItem(normalizeSourceItem(arxivRaw)), asOf);
    expect(filterItems([paper], { ...defaultFilters, query: "researcher", contentType: "paper" }, asOf)).toHaveLength(1);
    const base = Date.parse("2026-10-14T00:00:00.000Z");
    const snapshots = Array.from({ length: 14 }, (_, index) => ({
      date: new Date(base - (13 - index) * 86_400_000).toISOString().slice(0, 10), items: [paper],
      sources: [{ source: "arxiv" as const, status: "success" as const }],
    }));
    expect(computeTrendWindow(snapshots, 7)).toMatchObject({ ready: true, contentTypes: { paper: 7 } });
    expect(computeTrendWindow(snapshots.map((snapshot, index) => index === 3 ?
      { ...snapshot, sources: [{ source: "arxiv" as const, status: "failed" as const }] } : snapshot), 7))
      .toMatchObject({ ready: false, reason: "source_coverage" });
  });
});

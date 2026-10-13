import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubSearchCollector } from "../collectors/github";
import { classifyItem } from "../pipeline/classification";
import { deduplicateItems } from "../pipeline/deduplicate";
import { normalizeGitHubRawItem } from "../pipeline/normalize";
import { popularityScore, rankItem } from "../pipeline/ranking";
import { processGitHubCollection } from "../pipeline/run";
import { publishCollection, readFirstSeenHistory, readLatest, recordFailure } from "../lib/data-store";
import { loadPreview } from "../lib/preview-data";
import { isDataStale } from "../lib/freshness";
import { LatestSchema } from "../types/publication";
import { validGitHubRawItem } from "./fixtures/github-normalize";
import { githubRepository, githubResponse } from "./fixtures/github-search-response";

const asOf = "2026-10-13T09:00:00.000Z";
const day = "2026-10-12";
const base = normalizeGitHubRawItem(validGitHubRawItem);
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), "radar-pipeline-"));
  roots.push(root);
  return root;
}

async function fakeCollection() {
  const collector = new GitHubSearchCollector({
    queries: [{ id: "mcp", query: "topic:mcp" }], now: () => asOf,
  });
  return collector.collect({
    asOf, windowStart: "2026-10-12T00:00:00.000Z", windowEnd: "2026-10-13T00:00:00.000Z",
    cursor: null,
    http: { get: async () => ({
      ok: true, status: 200, headers: {}, body: githubResponse([githubRepository]),
    }) },
  });
}

describe("Deduplicate", () => {
  it("merges only identical numeric repository IDs, preserves earliest firstSeenAt and latest observation", () => {
    const old = { ...base, firstSeenAt: "2026-10-10T09:00:00.000Z" };
    const newer = { ...base, collectedAt: "2026-10-14T09:00:00.000Z",
      metadata: { ...base.metadata, stars: 100, matchedQueryIds: ["agent"] },
      sourceRefs: [{ source: "github-trending", externalId: "123", url: base.url }] };
    const other = { ...base, id: "github-repo:456" };
    const left = deduplicateItems([newer, other, old]);
    const right = deduplicateItems([old, newer, other]);
    expect(left).toEqual(right);
    expect(left.inputCount).toBe(3);
    expect(left.outputCount).toBe(2);
    expect(left.duplicateCount).toBe(1);
    expect(left.items[0].firstSeenAt).toBe(old.firstSeenAt);
    expect(left.items[0].metadata.stars).toBe(100);
    expect(left.items[0].metadata.matchedQueryIds).toEqual(["agent", "mcp"]);
    expect(left.items[0].sourceRefs).toHaveLength(2);
  });

  it("rejects an invalid item without merging similar titles across IDs", () => {
    const result = deduplicateItems([base, { ...base, id: "github-repo:456" }, { ...base, id: "" }]);
    expect(result.outputCount).toBe(2);
    expect(result.rejected).toEqual([{ index: 2, reason: "invalid_normalized_item" }]);
  });
});

describe("Classification and ranking", () => {
  it("recognizes strong topic evidence, aliases, and official Owner while ignoring search query hits", () => {
    const item = { ...base, title: "openai/mcp-server", metadata: {
      ...base.metadata, owner: "openai", description: "Forward deployed engineer builds retrieval-augmented generation",
      githubTopics: ["ai-coding"], matchedQueryIds: ["enterprise-ai"],
    } };
    const classified = classifyItem(item);
    expect(classified.topics).toEqual(["rag", "mcp", "ai-coding", "fde"]);
    expect(classified.topics).not.toContain("enterprise-ai");
    expect(classified.companies).toEqual(["openai"]);
  });

  it("does not match short fragments or infer company from a description", () => {
    const item = { ...base, title: "example/agency", metadata: {
      ...base.metadata, owner: "example", description: "OpenAI example; fragmented architecture",
      githubTopics: [], matchedQueryIds: ["mcp", "agent"],
    } };
    expect(classifyItem(item)).toMatchObject({ topics: [], companies: [] });
  });

  it("uses verified organization Owners for Anthropic and DeepSeek, not similar account names", () => {
    const withOwner = (owner: string) => classifyItem({
      ...base, metadata: { ...base.metadata, owner },
    }).companies;
    expect(withOwner("anthropics")).toEqual(["anthropic"]);
    expect(withOwner("deepseek-ai")).toEqual(["deepseek"]);
    expect(withOwner("anthropic")).toEqual([]);
    expect(withOwner("deepseek")).toEqual([]);
  });

  it("uses fixed anchors, 0 stars, and bounded score contributions deterministically", () => {
    const zero = classifyItem({ ...base, metadata: { ...base.metadata, stars: 0, forks: 0, lastPushedAt: null } });
    expect(popularityScore(zero)).toBe(0);
    const ranked = rankItem(zero, asOf);
    expect(ranked.publishedAt).toBeNull();
    expect(ranked.scoreBreakdown.freshness).toBe(0);
    expect(ranked.scoreBreakdown.popularity).toBe(0);
    expect(ranked).toEqual(rankItem(zero, asOf));
    expect(ranked.scoreBreakdown.topic).toBeLessThanOrEqual(35);
    expect(ranked.scoreBreakdown.source).toBeLessThanOrEqual(20);
    expect(ranked.scoreBreakdown.novelty).toBeLessThanOrEqual(10);
    expect(ranked.personalScore).toBeCloseTo(Object.entries(ranked.scoreBreakdown)
      .filter(([, value]) => typeof value === "number").reduce((sum, [, value]) => sum + Number(value), 0), 4);
  });

  it("rejects missing popularity observations rather than treating them as measured zero", () => {
    const item = classifyItem({ ...base, metadata: { ...base.metadata, stars: null } });
    expect(() => rankItem(item, asOf)).toThrow("Missing or invalid GitHub popularity metric");
  });

  it("sets freshness and novelty to zero for future evidence", () => {
    const item = classifyItem({ ...base, firstSeenAt: "2026-10-14T09:00:00.000Z",
      metadata: { ...base.metadata, lastPushedAt: "2026-10-14T09:00:00.000Z" } });
    const ranked = rankItem(item, asOf);
    expect(ranked.scoreBreakdown.freshness).toBe(0);
    expect(ranked.scoreBreakdown.novelty).toBe(0);
  });

  it("keeps each weighted contribution within the existing contract and exposes its fixed asOf", () => {
    const ranked = rankItem(classifyItem(base), asOf);
    expect(ranked.scoreBreakdown).toMatchObject({
      topic: 33.25, source: 16, freshness: 20, novelty: 8, asOf,
    });
    expect(ranked.scoreBreakdown.popularity).toBeCloseTo(popularityScore(classifyItem(base)) * 0.15, 3);
    expect(ranked.scoreBreakdown.popularity).toBeLessThanOrEqual(15);
  });

  it("decays old push and first-seen observations without fabricating publication time", () => {
    const old = classifyItem({ ...base, firstSeenAt: "2026-01-01T00:00:00.000Z",
      metadata: { ...base.metadata, lastPushedAt: "2026-01-01T00:00:00.000Z" } });
    const ranked = rankItem(old, asOf);
    expect(ranked.publishedAt).toBeNull();
    expect(ranked.scoreBreakdown.freshness).toBe(1);
    expect(ranked.scoreBreakdown.novelty).toBe(1);
  });
});

describe("Collector to validated JSON and static preview", () => {
  it("detects staleness at visit time without rebuilding the static page", () => {
    expect(isDataStale(asOf, "2026-10-15T09:00:00.000Z")).toBe(false);
    expect(isDataStale(asOf, "2026-10-15T09:00:00.001Z")).toBe(true);
  });

  it("runs the full offline chain, saves history, retains firstSeenAt, and reruns idempotently", async () => {
    const root = await tempRoot();
    const collected = await fakeCollection();
    const processed = processGitHubCollection(collected, day, asOf, new Map());
    expect(processed.status).toBe("success");
    if (processed.status !== "success") return;
    await publishCollection(root, processed.latest, collected);
    const first = await readFile(join(root, "data", "latest.json"), "utf8");
    await publishCollection(root, processed.latest, collected);
    expect(await readFile(join(root, "data", "latest.json"), "utf8")).toBe(first);
    expect(LatestSchema.parse(JSON.parse(first))).toEqual(processed.latest);
    expect((await readFirstSeenHistory(root, "2026-10-14T09:00:00.000Z")).get("123")).toBe(asOf);
    expect(await readFile(join(root, "public", "data", "latest.json"), "utf8")).toBe(first);
    expect(await readFile(join(root, "data", day, "items.json"), "utf8")).toBe(first);
    expect(await stat(join(root, "data", "raw", day, "github-search.json"))).toBeDefined();
    await expect(stat(join(root, "public", "data", "raw", day, "github-search.json"))).rejects.toThrow();
    const preview = await loadPreview(root, "2026-10-13T10:00:00.000Z");
    expect(preview.latest?.items[0].id).toBe("github-repo:123");
    expect(preview.stale).toBe(false);
  });

  it("preserves latest on partial failure or anomalous collapse and reports failure status", async () => {
    const root = await tempRoot();
    const collected = await fakeCollection();
    const good = processGitHubCollection(collected, day, asOf, new Map());
    if (good.status !== "success") throw new Error("Expected success");
    await publishCollection(root, good.latest, collected);
    const old = await readFile(join(root, "data", "latest.json"), "utf8");
    const partial = { ...collected, status: "partial" as const,
      errors: [{ code: "rate_limited", message: "Rate limit", retryable: true }] };
    const processed = processGitHubCollection(partial, day, asOf, new Map(), 1);
    expect(processed.status).toBe("partial");
    if (processed.status === "success") return;
    await recordFailure(root, good.latest, processed.status, asOf, partial, processed.errorCodes);
    expect(await readFile(join(root, "data", "latest.json"), "utf8")).toBe(old);
    expect((await loadPreview(root, "2026-10-13T10:00:00.000Z")).message).toContain("未达到发布门槛");
    expect(processGitHubCollection(collected, day, asOf, new Map(), 10).status).toBe("anomaly");
    expect(processGitHubCollection(collected, day, asOf, new Map(), 2).status).toBe("success");
    expect(processGitHubCollection(collected, day, asOf, new Map(), 3).status).toBe("anomaly");
    expect(processGitHubCollection({ ...collected, collectorId: "another-source" },
      day, asOf, new Map()).status).toBe("schema_failed");
  });

  it("shows empty and stale states without fixtures in production files", async () => {
    const root = await tempRoot();
    expect((await loadPreview(root, asOf)).latest).toBeNull();
    const collected = await fakeCollection();
    const processed = processGitHubCollection(collected, day, asOf, new Map());
    if (processed.status !== "success") throw new Error("Expected success");
    await publishCollection(root, processed.latest, collected);
    expect((await loadPreview(root, "2026-10-16T09:00:00.000Z")).stale).toBe(true);
    expect((await readLatest(root))?.itemCount).toBe(1);
  });

  it("preserves historical firstSeenAt when the same repository appears on a later day", async () => {
    const root = await tempRoot();
    const collected = await fakeCollection();
    const first = processGitHubCollection(collected, day, asOf, new Map());
    if (first.status !== "success") throw new Error("Expected success");
    await publishCollection(root, first.latest, collected);
    const nextAsOf = "2026-10-14T09:00:00.000Z";
    const next = { ...collected, items: collected.items.map((item) => ({
      ...item, collectedAt: nextAsOf, data: { ...item.data, pushed_at: "2026-10-13T10:00:00Z" },
    })) };
    const history = await readFirstSeenHistory(root, nextAsOf);
    const second = processGitHubCollection(next, "2026-10-13", nextAsOf, history, 1);
    expect(second.status).toBe("success");
    if (second.status !== "success") return;
    expect(second.latest.items[0].firstSeenAt).toBe(asOf);
    expect(second.latest.items[0].collectedAt).toBe(nextAsOf);
    await publishCollection(root, second.latest, next);
    expect((await readLatest(root))?.date).toBe("2026-10-13");
    expect(await stat(join(root, "data", day, "items.json"))).toBeDefined();
  });

  it("blocks inconsistent publication counts and URL queries that could contain credentials", async () => {
    const root = await tempRoot();
    const collected = await fakeCollection();
    const processed = processGitHubCollection(collected, day, asOf, new Map());
    if (processed.status !== "success") throw new Error("Expected success");
    expect(LatestSchema.safeParse({ ...processed.latest, itemCount: 2 }).success).toBe(false);
    expect(LatestSchema.safeParse({ ...processed.latest, items: [
      ...processed.latest.items, processed.latest.items[0],
    ] }).success).toBe(false);
    const unsafe = { ...collected, items: collected.items.map((item) => ({
      ...item, url: item.url + "?token=secret",
    })) };
    await expect(publishCollection(root, processed.latest, unsafe)).rejects.toThrow("Unsafe GitHub RawItem URL");
    expect(await readLatest(root)).toBeNull();
  });

  it("reports the first failed collection clearly when no valid latest exists", async () => {
    const root = await tempRoot();
    const collected = await fakeCollection();
    await recordFailure(root, null, "partial", asOf, collected, ["rate_limited"]);
    const preview = await loadPreview(root, asOf);
    expect(preview.latest).toBeNull();
    expect(preview.message).toContain("采集失败");
  });

  it("does not render malformed published JSON as an empty healthy result", async () => {
    const root = await tempRoot();
    await mkdir(join(root, "public", "data"), { recursive: true });
    await writeFile(join(root, "public", "data", "latest.json"), "{broken", "utf8");
    const preview = await loadPreview(root, asOf);
    expect(preview.latest).toBeNull();
    expect(preview.message).toContain("校验失败");
  });
});

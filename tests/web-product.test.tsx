import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { UnconnectedRadar } from "../components/unconnected-radar";
import { defaultFilters, detailId, filterItems, formatCount, formatShanghai,
  hasTrendHistory, topicCounts } from "../lib/web-data";
import { detailHref, sitePath } from "../lib/site-path";
import { emptySavedState, exportSavedState, mergeSavedState, parseSavedState,
  updateExistingEntry, updateSavedEntry } from "../lib/saved-state";
import { computeTrendWindow, loadTrendSnapshots } from "../lib/trend-data";
import { loadPreview } from "../lib/preview-data";
import { validIntelligenceItem } from "./fixtures/intelligence-item";
import type { IntelligenceItem } from "../types/intelligence-item";

const asOf = "2026-10-13T10:00:00.000Z";
const first = { ...validIntelligenceItem, id: "github-repo:1", title: "Agent MCP Toolkit",
  source: "github", personalScore: 91,
  metadata: { stars: 120, forks: 10, owner: "sample", description: "Reliable agent toolkit",
    githubTopics: ["mcp"], lastPushedAt: "2026-10-12T10:00:00.000Z" } } as IntelligenceItem;
const second = { ...validIntelligenceItem, id: "github-repo:2", title: "Search Index",
  source: "github", contentType: "repository", topics: ["ai-search"], personalScore: 55,
  metadata: { stars: 600, forks: 20, owner: "another", description: "Semantic search",
    githubTopics: ["search"], lastPushedAt: "2026-09-01T10:00:00.000Z" } } as IntelligenceItem;
const items = [first, second];
const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("Web search, navigation, and facts", () => {
  it("combines full-text, topic, type, source, score range, and activity time", () => {
    const matching = filterItems(items, { ...defaultFilters, query: "RELIABLE", topic: "mcp",
      contentType: "repository", source: "github", minScore: 80, maxScore: 95, time: "1d" }, asOf);
    expect(matching.map((item) => item.id)).toEqual(["github-repo:1"]);
    expect(filterItems(items, { ...defaultFilters, query: "another", topic: "mcp" }, asOf)).toEqual([]);
    expect(filterItems(items, { ...defaultFilters, contentType: "paper" }, asOf)).toEqual([]);
    expect(filterItems(items, { ...defaultFilters, time: "7d" }, asOf).map((item) => item.id)).toEqual(["github-repo:1"]);
  });

  it("sorts by score, stars and name without mutating the input", () => {
    expect(filterItems(items, defaultFilters, asOf).map((item) => item.id)).toEqual(["github-repo:1", "github-repo:2"]);
    expect(filterItems(items, { ...defaultFilters, sort: "stars" }, asOf).map((item) => item.id))
      .toEqual(["github-repo:2", "github-repo:1"]);
    expect(filterItems(items, { ...defaultFilters, sort: "score-asc" }, asOf)[0].id).toBe("github-repo:2");
    expect(items[0].id).toBe("github-repo:1");
  });

  it("counts canonical topics per item and formats exact observed numbers and Shanghai times", () => {
    expect(topicCounts([first, { ...first, topics: ["mcp", "mcp"] }]).get("mcp")).toBe(2);
    expect(formatCount(6283)).toBe("6,283");
    expect(formatShanghai("2026-10-13T13:24:42.319Z")).toContain("21:24");
    expect(formatShanghai(null)).toBe("未提供");
  });

  it("resolves fixed static detail route and GitHub Pages base path", () => {
    expect(detailId("?id=github-repo%3A123")).toBe("github-repo:123");
    expect(detailId("?id=<script>")).toBeNull();
    expect(detailId("?q=missing")).toBeNull();
    expect(sitePath("/topics", "/ai-frontier-radar")).toBe("/ai-frontier-radar/topics/");
    expect(detailHref("github-repo:123", "/ai-frontier-radar"))
      .toBe("/ai-frontier-radar/detail/?id=github-repo%3A123");
  });
});

describe("Browser-only saved state", () => {
  it("persists stable IDs, toggles saved/read/hidden, and retains orphan snapshots", () => {
    let state = updateSavedEntry(emptySavedState(), first, "saved", asOf);
    state = updateSavedEntry(state, first, "read", asOf);
    state = updateSavedEntry(state, first, "hidden", asOf);
    expect(state.entries[first.id]).toMatchObject({ saved: true, read: true, hidden: true });
    const restored = parseSavedState(exportSavedState(state));
    expect(restored.entries[first.id].snapshot.title).toBe(first.title);
    expect(restored.entries[first.id].saved).toBe(true);
    expect(items.filter((item) => !restored.entries[item.id]?.hidden).map((item) => item.id)).toEqual([second.id]);
    expect(Object.keys(restored.entries)).toContain(first.id);
    expect(updateExistingEntry(restored, first.id, "saved", asOf).entries[first.id].saved).toBe(false);
  });

  it("validates imports and merges by ID without losing other local records", () => {
    const current = updateSavedEntry(emptySavedState(), first, "saved", asOf);
    const incoming = updateSavedEntry(emptySavedState(), second, "saved", asOf);
    expect(Object.keys(mergeSavedState(current, parseSavedState(exportSavedState(incoming))).entries).sort())
      .toEqual([first.id, second.id]);
    expect(() => parseSavedState("{broken")).toThrow();
    expect(() => parseSavedState(JSON.stringify({ version: 1, entries: {
      bad: { saved: true, read: false, hidden: false, updatedAt: asOf,
        snapshot: { title: "bad", url: "javascript:alert(1)", source: "x", contentType: "repository" } },
    } }))).toThrow();
  });
});

describe("Historical trend and published data boundaries", () => {
  it("shows insufficient history for one day or a gap, then computes only complete windows", () => {
    const base = Date.parse("2026-10-13T00:00:00.000Z");
    const dates = Array.from({ length: 14 }, (_, index) =>
      new Date(base - (13 - index) * 86_400_000).toISOString().slice(0, 10));
    expect(hasTrendHistory(dates, 7)).toBe(true);
    expect(hasTrendHistory(dates.slice(1), 7)).toBe(false);
    const snapshots = dates.map((date, index) => ({ date, items: index < 7 ? [second] : [first, second] }));
    expect(computeTrendWindow(snapshots.slice(0, 1), 7).ready).toBe(false);
    expect(computeTrendWindow(snapshots.filter((_, index) => index !== 5), 7).ready).toBe(false);
    const trend = computeTrendWindow(snapshots, 7);
    expect(trend.ready).toBe(true);
    expect(trend.topics.find((entry) => entry.id === "ai-search")).toMatchObject({ current: 7, previous: 7, growthRate: 0 });
    expect(trend.topics.find((entry) => entry.id === "agent")).toMatchObject({ current: 7, previous: 0, growthRate: null });
  });

  it("rejects a mismatched manifest and excludes corrupt history from trend evidence", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-web-")); roots.push(root);
    await mkdir(join(root, "public", "data"), { recursive: true });
    await mkdir(join(root, "data", "2026-10-12"), { recursive: true });
    const latest = { schemaVersion: 1, date: "2026-10-12", asOf, source: "github-search", status: "success",
      receivedCount: 1, acceptedCount: 1, normalizedCount: 1, duplicateCount: 0,
      rejectedCount: 0, itemCount: 1, items: [first] };
    await writeFile(join(root, "public", "data", "latest.json"), JSON.stringify(latest));
    await writeFile(join(root, "public", "data", "manifest.json"), JSON.stringify({ schemaVersion: 1,
      latestDate: "2026-10-11", latestAsOf: asOf, itemCount: 1, dates: ["2026-10-11"] }));
    expect((await loadPreview(root, asOf)).latest).toBeNull();
    await writeFile(join(root, "data", "2026-10-12", "items.json"), "{broken");
    expect(await loadTrendSnapshots(root, ["2026-10-12"])).toEqual([]);
  });

  it("renders planned sources as unconnected, without fabricated repository cards", () => {
    for (const radarType of ["products", "startups", "funding", "research", "career"] as const) {
      const html = renderToStaticMarkup(<UnconnectedRadar module={radarType} />);
      expect(html).toContain("数据源尚未接入");
      expect(html).not.toContain("Personal Score");
      expect(html).not.toContain("github-repo:");
    }
  });
});

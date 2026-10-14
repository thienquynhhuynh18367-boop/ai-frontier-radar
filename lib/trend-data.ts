import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LatestSchema, type Latest, type SourceRun } from "../types/publication";
import { hasTrendHistory } from "./web-data";

export type TrendSnapshot = Pick<Latest, "date" | "items"> & { sources?: readonly Pick<SourceRun, "source" | "status">[] };
export type TopicTrend = { id: string; current: number; previous: number; growthRate: number | null;
  state: "rising" | "stable" | "emerging" | "cooling" | "noise" };
export type TrendWindow = { days: 7 | 30 | 90; ready: boolean; observedDays: number; topics: TopicTrend[];
  reason?: "incomplete_history" | "source_coverage"; contentTypes?: Record<string, number>;
  previousContentTypes?: Record<string, number>;
  sourceDiversity?: { current: number; previous: number }; starDelta?: { delta: number; observedRepos: number } | null;
  previousStarDelta?: { delta: number; observedRepos: number } | null };

export async function loadTrendSnapshots(root: string, dates: readonly string[]): Promise<TrendSnapshot[]> {
  const snapshots: TrendSnapshot[] = [];
  for (const date of [...new Set(dates)].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    try {
      const data = JSON.parse(await readFile(join(root, "data", date, "items.json"), "utf8")) as unknown;
      const parsed = LatestSchema.safeParse(data);
      if (parsed.success && parsed.data.date === date) snapshots.push({ date, items: parsed.data.items,
        ...(parsed.data.schemaVersion === 2 ? { sources: parsed.data.sources } : {}) });
    } catch { /* 缺失/损坏日期不填零，阻止假趋势。 */ }
  }
  return snapshots;
}

function coverage(snapshot: TrendSnapshot): string | null {
  const sources = snapshot.sources ?? [{ source: "github-search", status: "success" }];
  if (sources.some((source) => source.status !== "success" && source.status !== "empty")) return null;
  return sources.map((source) => source.source).sort().join("|");
}

function counts(group: readonly TrendSnapshot[], field: "topics" | "contentType"): Map<string, number> {
  const result = new Map<string, number>();
  for (const snapshot of group) for (const item of snapshot.items) {
    const values = field === "topics" ? [...new Set(item.topics)] : [item.contentType];
    for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function starDelta(group: readonly TrendSnapshot[]): { delta: number; observedRepos: number } | null {
  const observations = new Map<string, number[]>();
  for (const snapshot of group) for (const item of snapshot.items) {
    if (item.contentType !== "repository" || item.source !== "github") continue;
    const stars = item.metadata.stars;
    if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 0) continue;
    const values = observations.get(item.id) ?? [];
    values.push(stars); observations.set(item.id, values);
  }
  const pairs = [...observations.values()].filter((values) => values.length >= 2);
  return pairs.length ? { delta: pairs.reduce((sum, values) => sum + values.at(-1)! - values[0], 0),
    observedRepos: pairs.length } : null;
}

export function computeTrendWindow(snapshots: readonly TrendSnapshot[], days: 7 | 30 | 90): TrendWindow {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (!hasTrendHistory(ordered.map((snapshot) => snapshot.date), days)) {
    return { days, ready: false, observedDays: ordered.length, topics: [], reason: "incomplete_history" };
  }
  const compared = ordered.slice(-days * 2);
  const signatures = compared.map(coverage);
  if (signatures.some((signature) => signature === null) || new Set(signatures).size !== 1) {
    return { days, ready: false, observedDays: ordered.length, topics: [], reason: "source_coverage" };
  }
  const recent = compared.slice(-days);
  const previous = compared.slice(0, days);
  const currentCount = counts(recent, "topics");
  const previousCount = counts(previous, "topics");
  const ids = [...new Set([...currentCount.keys(), ...previousCount.keys()])].sort();
  const types = Object.fromEntries([...counts(recent, "contentType")].sort(([a], [b]) => a.localeCompare(b)));
  const previousTypes = Object.fromEntries([...counts(previous, "contentType")].sort(([a], [b]) => a.localeCompare(b)));
  const diversity = (group: readonly TrendSnapshot[]) => new Set(group.flatMap((snapshot) => snapshot.items.flatMap((item) => item.sourceRefs.map((ref) => ref.source)))).size;
  const sourceDiversity = { current: diversity(recent), previous: diversity(previous) };
  return { days, ready: true, observedDays: ordered.length, contentTypes: types, previousContentTypes: previousTypes, sourceDiversity,
    starDelta: signatures[0]?.includes("github-search") ? starDelta(recent) : null,
    previousStarDelta: signatures[0]?.includes("github-search") ? starDelta(previous) : null,
    topics: ids.map((id) => {
      const current = currentCount.get(id) ?? 0;
      const previous = previousCount.get(id) ?? 0;
      const growthRate = previous === 0 ? null : (current - previous) / previous;
      // 状态是可审查的计数阈值，低样本一律标噪音或萌芽，不输出主观行业观点。
      const state: TopicTrend["state"] = current < 2 ? "noise" : previous === 0 ? "emerging"
        : current >= 5 && sourceDiversity.current >= 2 && growthRate! >= 0.3 ? "rising"
        : current >= 5 && growthRate! <= -0.3 ? "cooling" : "stable";
      return { id, current, previous, growthRate, state };
    }).sort((a, b) => b.current - a.current || a.id.localeCompare(b.id)) };
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LatestSchema, type Latest } from "../types/publication";
import { hasTrendHistory } from "./web-data";

export type TrendSnapshot = Pick<Latest, "date" | "items">;
export type TopicTrend = { id: string; current: number; previous: number; growthRate: number | null };
export type TrendWindow = { days: 7 | 30 | 90; ready: boolean; observedDays: number; topics: TopicTrend[] };

export async function loadTrendSnapshots(root: string, dates: readonly string[]): Promise<TrendSnapshot[]> {
  const snapshots: TrendSnapshot[] = [];
  for (const date of [...new Set(dates)].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    try {
      const data = JSON.parse(await readFile(join(root, "data", date, "items.json"), "utf8")) as unknown;
      const parsed = LatestSchema.safeParse(data);
      if (parsed.success && parsed.data.date === date) snapshots.push(parsed.data);
    } catch {
      // 缺失或损坏的日期不填零；窗口完整性检查将阻止趋势结论。
    }
  }
  return snapshots;
}

export function computeTrendWindow(snapshots: readonly TrendSnapshot[], days: 7 | 30 | 90): TrendWindow {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  if (!hasTrendHistory(ordered.map((snapshot) => snapshot.date), days)) {
    return { days, ready: false, observedDays: ordered.length, topics: [] };
  }
  const recent = ordered.slice(-days);
  const previous = ordered.slice(-days * 2, -days);
  const count = (group: readonly TrendSnapshot[]) => {
    const totals = new Map<string, number>();
    for (const day of group) for (const item of day.items) for (const topic of new Set(item.topics)) {
      totals.set(topic, (totals.get(topic) ?? 0) + 1);
    }
    return totals;
  };
  const currentCount = count(recent);
  const previousCount = count(previous);
  const ids = [...new Set([...currentCount.keys(), ...previousCount.keys()])].sort();
  return { days, ready: true, observedDays: ordered.length,
    topics: ids.map((id) => {
      const current = currentCount.get(id) ?? 0;
      const previous = previousCount.get(id) ?? 0;
      return { id, current, previous, growthRate: previous === 0 ? null : (current - previous) / previous };
    }).sort((a, b) => b.current - a.current || a.id.localeCompare(b.id)),
  };
}

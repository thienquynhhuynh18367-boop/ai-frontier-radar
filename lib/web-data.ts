import type { IntelligenceItem } from "../types/intelligence-item";

export type ItemFilters = {
  query: string; topic: string; contentType: string; source: string;
  minScore: number; maxScore: number; time: "all" | "1d" | "7d" | "30d" | "90d";
  sort: "score" | "score-asc" | "pushed" | "stars" | "name";
};

export const defaultFilters: ItemFilters = {
  query: "", topic: "all", contentType: "all", source: "all",
  minScore: 0, maxScore: 100, time: "all", sort: "score",
};

const timeDays = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 } as const;

export function metadataText(item: IntelligenceItem, key: string): string | null {
  const value = item.metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function metadataNumber(item: IntelligenceItem, key: string): number | null {
  const value = item.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function metadataStrings(item: IntelligenceItem, key: string): string[] {
  const value = item.metadata[key];
  return Array.isArray(value) ? value.filter((part): part is string => typeof part === "string") : [];
}

export function itemActivityAt(item: IntelligenceItem): string | null {
  return item.contentType === "repository" ? metadataText(item, "lastPushedAt")
    : item.contentType === "job" ? metadataText(item, "updatedAt")
      : item.publishedAt ?? (item.sourceType === "sitemap" ? metadataText(item, "lastmod") : null);
}

export function filterItems(items: readonly IntelligenceItem[], filters: ItemFilters, asOf: string): IntelligenceItem[] {
  const needle = filters.query.trim().toLocaleLowerCase();
  const asOfMs = Date.parse(asOf);
  const matches = items.filter((item) => {
    if (filters.topic !== "all" && !item.topics.includes(filters.topic)) return false;
    if (filters.contentType !== "all" && item.contentType !== filters.contentType) return false;
    if (filters.source !== "all" && item.source !== filters.source) return false;
    if (item.personalScore < filters.minScore || item.personalScore > filters.maxScore) return false;
    if (filters.time !== "all") {
      const activity = itemActivityAt(item);
      const age = activity ? asOfMs - Date.parse(activity) : Number.NaN;
      if (!Number.isFinite(age) || age < 0 || age > timeDays[filters.time] * 86_400_000) return false;
    }
    if (!needle) return true;
    const haystack = [item.title, metadataText(item, "description") ?? "",
      metadataText(item, "owner") ?? "", ...metadataStrings(item, "githubTopics"),
      metadataText(item, "author") ?? "", ...metadataStrings(item, "authors"),
      ...metadataStrings(item, "categories"), item.source, item.contentType,
      ...item.topics, ...item.companies].join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
  return matches.sort((a, b) => {
    if (filters.sort === "score-asc") return a.personalScore - b.personalScore || a.id.localeCompare(b.id);
    if (filters.sort === "pushed") return (itemActivityAt(b) ?? "").localeCompare(itemActivityAt(a) ?? "") || a.id.localeCompare(b.id);
    if (filters.sort === "stars") return (metadataNumber(b, "stars") ?? -1) - (metadataNumber(a, "stars") ?? -1) || a.id.localeCompare(b.id);
    if (filters.sort === "name") return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    return b.personalScore - a.personalScore || a.id.localeCompare(b.id);
  });
}

export function diverseTopItems(items: readonly IntelligenceItem[], limit = 10): IntelligenceItem[] {
  const sorted = [...items].sort((a, b) => b.personalScore - a.personalScore || a.id.localeCompare(b.id));
  const selected: IntelligenceItem[] = [];
  const used = new Set<string>();
  for (const source of [...new Set(sorted.map((item) => item.source))]) {
    const candidate = sorted.find((item) => item.source === source && !used.has(item.id));
    if (candidate && selected.length < limit) { selected.push(candidate); used.add(candidate.id); }
  }
  for (const item of sorted) if (selected.length < limit && !used.has(item.id)) { selected.push(item); used.add(item.id); }
  return selected.sort((a, b) => b.personalScore - a.personalScore || a.id.localeCompare(b.id));
}

export function topicCounts(items: readonly IntelligenceItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) for (const topic of new Set(item.topics)) {
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }
  return counts;
}

export function detailId(search: string): string | null {
  const id = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("id");
  return id && /^[a-z0-9][a-z0-9:._-]{0,199}$/.test(id) ? id : null;
}

export function formatShanghai(value: string | null, withTime = true): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "未提供";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).format(new Date(value)) + "（北京时间）";
}

export function formatCount(value: number | null): string {
  return value === null ? "未提供" : new Intl.NumberFormat("zh-CN").format(value);
}

export function hasTrendHistory(dates: readonly string[], days: 7 | 30 | 90): boolean {
  // 至少有完整连续的当前窗口和上一等长窗口，才有比较增长率的基础。
  if (dates.length < days * 2) return false;
  const unique = [...new Set(dates)].sort();
  if (unique.length < days * 2) return false;
  const newest = Date.parse(unique.at(-1)! + "T00:00:00.000Z");
  return Array.from({ length: days * 2 }, (_, index) =>
    new Date(newest - index * 86_400_000).toISOString().slice(0, 10))
    .every((date) => unique.includes(date));
}

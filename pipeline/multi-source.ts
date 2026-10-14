import { normalizeGitHubRawItems } from "./normalize/github";
import { normalizeSourceItem } from "./normalize/sources";
import { deduplicateItems } from "./deduplicate";
import { classifyItem } from "./classification";
import { rankItem } from "./ranking";
import { MultiSourceLatestSchema, SourceRunSchema, type Latest, type SourceRun } from "../types/publication";
import { CollectorResultSchema, type CollectorResult } from "../types/collector";
import type { NormalizedItem } from "../types/normalized-item";
import { NormalizedItemSchema } from "../types/normalized-item";
import type { IntelligenceItem } from "../types/intelligence-item";

export type SourceBatch = { id: SourceRun["source"]; result: CollectorResult; queryStats?: SourceRun["queryStats"] };
export type MultiProcessResult = { status: "success" | "partial"; latest: Extract<Latest, { schemaVersion: 2 }> }
  | { status: "failed" | "schema_failed" | "empty"; errorCodes: string[]; sources: SourceRun[] };

const rawSource = (id: SourceRun["source"]) => id === "github-search" ? "github" : id;
function previousRun(previous: Latest | null, id: SourceRun["source"]): SourceRun | null {
  if (!previous) return null;
  if (previous.schemaVersion === 2) return previous.sources.find((source) => source.source === id) ?? null;
  if (id !== "github-search") return null;
  return SourceRunSchema.parse({ source: id, status: "success", lastAttemptAt: previous.asOf,
    lastSuccessAt: previous.asOf, receivedCount: previous.receivedCount, acceptedCount: previous.acceptedCount,
    itemCount: previous.itemCount, carriedCount: 0, consecutiveFailures: 0, errorCodes: [], queryStats: [] });
}

export function processMultiSource(batches: readonly SourceBatch[], date: string, asOf: string,
  previous: Latest | null, firstSeen: ReadonlyMap<string, string>): MultiProcessResult {
  const inputs: NormalizedItem[] = [];
  const carried: IntelligenceItem[] = [];
  const sources: SourceRun[] = [];
  let receivedCount = 0, acceptedCount = 0, rejectedCount = 0;
  for (const batch of batches) {
    const parsed = CollectorResultSchema.safeParse(batch.result);
    const prior = previousRun(previous, batch.id);
    // 跨源合并后的主来源可能变更；沿用判断必须看全部 SourceRefs。
    const old = previous?.items.filter((item) => item.sourceRefs.some((ref) => ref.source === rawSource(batch.id))) ?? [];
    let status: SourceRun["status"] = "success";
    const normalized: NormalizedItem[] = [];
    const errors = parsed.success && batch.result.collectorId === batch.id ? batch.result.errors.map((error) => error.code) : ["collector_contract"];
    if (parsed.success && batch.result.collectorId === batch.id) {
      receivedCount += batch.result.receivedCount;
      acceptedCount += batch.result.acceptedCount;
    }
    if (!parsed.success || batch.result.collectorId !== batch.id) status = "schema_failed";
    else if (batch.result.status === "failed") status = "failed";
    else {
      if (batch.id === "github-search") {
        const numericHistory = new Map([...firstSeen].flatMap(([id, value]) => id.startsWith("github-repo:") ? [[id.slice(12), value] as const] : []));
        const output = normalizeGitHubRawItems(batch.result.items, { firstSeenAtByRepositoryId: numericHistory });
        normalized.push(...output.items);
        rejectedCount += output.errors.length;
      } else {
        for (const input of batch.result.items) {
          try {
            const item = normalizeSourceItem(input);
            normalized.push({ ...item, firstSeenAt: firstSeen.get(item.id) ?? item.firstSeenAt });
          } catch { rejectedCount++; }
        }
      }
      if (normalized.length === 0 && batch.result.items.length > 0) status = "schema_failed";
      else if (batch.result.status === "partial" || normalized.length < batch.result.items.length) status = "partial";
      else if (normalized.length === 0) status = "empty";
      // 上次有效量大幅高于今天时，保留旧来源并标记异常，避免坏采样刷新日期。
      if (status === "success" && old.length >= 10 && normalized.length < Math.ceil(old.length * 0.5)) status = "anomaly";
      if (status === "success" || status === "empty" || status === "partial") inputs.push(...normalized);
    }
    const carry = status === "failed" || status === "schema_failed" || status === "anomaly" || status === "partial";
    if (carry) carried.push(...old);
    if (status === "schema_failed") errors.push("normalization_rejected");
    if (status === "anomaly") errors.push("item_count_drop");
    sources.push(SourceRunSchema.parse({ source: batch.id, status,
      lastAttemptAt: asOf, lastSuccessAt: ["success", "empty"].includes(status) ? asOf : prior?.lastSuccessAt ?? null,
      receivedCount: parsed.success && batch.result.collectorId === batch.id ? batch.result.receivedCount : 0,
      acceptedCount: parsed.success && batch.result.collectorId === batch.id ? batch.result.acceptedCount : 0,
      itemCount: 0, carriedCount: carry ? old.length : 0,
      consecutiveFailures: ["success", "empty"].includes(status) ? 0 : (prior?.consecutiveFailures ?? 0) + 1,
      errorCodes: [...new Set(errors)].sort(), queryStats: batch.queryStats ?? [] }));
  }
  if (inputs.length === 0) return { status: sources.every((source) => source.status === "empty") ? "empty" : "failed",
    errorCodes: ["no_fresh_items"], sources };
  try {
    const dedup = deduplicateItems([...inputs, ...carried.map((item) => NormalizedItemSchema.parse({
      schemaVersion: item.schemaVersion, id: item.id, title: item.title, url: item.url,
      canonicalUrl: item.canonicalUrl, source: item.source, sourceType: item.sourceType,
      sourceRefs: item.sourceRefs, contentType: item.contentType, publishedAt: item.publishedAt,
      firstSeenAt: item.firstSeenAt, collectedAt: item.collectedAt, metadata: item.metadata,
    }))]);
    if (dedup.rejected.length) return { status: "schema_failed", errorCodes: ["deduplication_rejected"], sources };
    const items = dedup.items.map((item) => rankItem(classifyItem(item), asOf))
      .sort((a, b) => b.personalScore - a.personalScore || a.id.localeCompare(b.id));
    // 旧来源条目保留原始 collectedAt/publishedAt；只在当轮统一 asOf 下重新评分。
    for (const run of sources) run.itemCount = items.filter((item) => item.sourceRefs.some((ref) => ref.source === rawSource(run.source))).length;
    const status = sources.some((source) => !["success", "empty"].includes(source.status)) ? "partial" : "success";
    const latest = MultiSourceLatestSchema.parse({ schemaVersion: 2, date, asOf, status,
      receivedCount, acceptedCount, normalizedCount: inputs.length,
      duplicateCount: dedup.duplicateCount, rejectedCount, itemCount: items.length, sources, items });
    return { status, latest };
  } catch {
    return { status: "schema_failed", errorCodes: ["publication_validation"], sources };
  }
}

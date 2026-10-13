import { CollectorResultSchema, type CollectorResult } from "../types/collector";
import { LatestSchema, type Latest } from "../types/publication";
import { UtcTimestampSchema } from "../types/primitives";
import { deduplicateItems } from "./deduplicate";
import { normalizeGitHubRawItems } from "./normalize";
import { classifyItem } from "./classification";
import { rankItem } from "./ranking";

export type PipelineResult =
  | { status: "success"; latest: Latest; rejectedReasons: string[] }
  | { status: "empty" | "partial" | "failed" | "schema_failed" | "anomaly"; errorCodes: string[] };

export function processGitHubCollection(
  result: CollectorResult,
  date: string,
  asOf: string,
  history: ReadonlyMap<string, string>,
  previousCount = 0,
): PipelineResult {
  UtcTimestampSchema.parse(asOf);
  const parsed = CollectorResultSchema.safeParse(result);
  if (!parsed.success || result.collectorId !== "github-search") {
    return { status: "schema_failed", errorCodes: ["collector_contract"] };
  }
  if (result.status === "failed") return { status: "failed", errorCodes: result.errors.map((e) => e.code) };
  // 目前只有一个 GitHub 来源；部分 Query 失败不能当作完整日报发布。
  if (result.status === "partial") return { status: "partial", errorCodes: result.errors.map((e) => e.code) };
  const normalized = normalizeGitHubRawItems(result.items, { firstSeenAtByRepositoryId: history });
  if (normalized.errors.length) return { status: "schema_failed", errorCodes: ["normalization_rejected"] };
  const dedup = deduplicateItems(normalized.items);
  if (dedup.rejected.length) return { status: "schema_failed", errorCodes: ["deduplication_rejected"] };
  if (!dedup.items.length) return { status: "empty", errorCodes: ["no_items"] };
  if (previousCount > 0 && dedup.items.length < Math.ceil(previousCount * 0.5)) {
    return { status: "anomaly", errorCodes: ["item_count_drop"] };
  }
  try {
    const items = dedup.items.map((item) => rankItem(classifyItem(item), asOf))
      .sort((a, b) => b.personalScore - a.personalScore || a.id.localeCompare(b.id));
    const latest = LatestSchema.parse({
      schemaVersion: 1, date, asOf, source: "github-search", status: "success",
      receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
      normalizedCount: normalized.items.length, duplicateCount: dedup.duplicateCount,
      rejectedCount: normalized.errors.length, itemCount: items.length, items,
    });
    return { status: "success", latest, rejectedReasons: dedup.rejected.map((e) => e.reason) };
  } catch {
    return { status: "schema_failed", errorCodes: ["intelligence_item_validation"] };
  }
}

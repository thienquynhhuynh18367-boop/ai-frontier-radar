import { z } from "zod";
import { IntelligenceItemSchema } from "./intelligence-item";
import { UtcTimestampSchema } from "./primitives";

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LegacyLatestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  date: DaySchema,
  asOf: UtcTimestampSchema,
  source: z.literal("github-search"),
  status: z.literal("success"),
  receivedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  normalizedCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  items: z.array(IntelligenceItemSchema),
}).superRefine((value, ctx) => {
  if (value.itemCount !== value.items.length || new Set(value.items.map((item) => item.id)).size !== value.itemCount) {
    ctx.addIssue({ code: "custom", path: ["itemCount"], message: "Count or IDs mismatch" });
  }
  if (value.normalizedCount - value.duplicateCount !== value.itemCount) {
    ctx.addIssue({ code: "custom", path: ["duplicateCount"], message: "Deduplication count mismatch" });
  }
  if (value.acceptedCount - value.rejectedCount !== value.normalizedCount) {
    ctx.addIssue({ code: "custom", path: ["rejectedCount"], message: "Normalization count mismatch" });
  }
});
export const SourceRunSchema = z.strictObject({
  source: z.enum(["github-search", "hacker-news", "arxiv", "openai", "anthropic", "anthropic-jobs"]),
  status: z.enum(["success", "empty", "partial", "failed", "schema_failed", "anomaly", "carried"]),
  lastAttemptAt: UtcTimestampSchema,
  lastSuccessAt: UtcTimestampSchema.nullable(),
  receivedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  carriedCount: z.number().int().nonnegative(),
  consecutiveFailures: z.number().int().nonnegative(),
  errorCodes: z.array(z.string()),
  queryStats: z.array(z.strictObject({
    id: z.string(), received: z.number().int().nonnegative(), accepted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(), requests: z.number().int().nonnegative(),
  })),
});
export type SourceRun = z.infer<typeof SourceRunSchema>;

export const MultiSourceLatestSchema = z.strictObject({
  schemaVersion: z.literal(2),
  date: DaySchema,
  asOf: UtcTimestampSchema,
  status: z.enum(["success", "partial"]),
  receivedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  normalizedCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  sources: z.array(SourceRunSchema).min(1),
  items: z.array(IntelligenceItemSchema),
}).superRefine((value, ctx) => {
  if (new Set(value.sources.map((source) => source.source)).size !== value.sources.length) {
    ctx.addIssue({ code: "custom", path: ["sources"], message: "Duplicate source run" });
  }
  if (value.receivedCount !== value.sources.reduce((n, source) => n + source.receivedCount, 0) ||
      value.acceptedCount !== value.sources.reduce((n, source) => n + source.acceptedCount, 0)) {
    ctx.addIssue({ code: "custom", path: ["sources"], message: "Source counts mismatch" });
  }
  if (value.itemCount !== value.items.length || new Set(value.items.map((item) => item.id)).size !== value.itemCount) {
    ctx.addIssue({ code: "custom", path: ["itemCount"], message: "Count or IDs mismatch" });
  }
  if (value.normalizedCount - value.duplicateCount !== value.itemCount - value.sources.reduce((n, s) => n + s.carriedCount, 0)) {
    ctx.addIssue({ code: "custom", path: ["duplicateCount"], message: "Deduplication count mismatch" });
  }
  if (value.acceptedCount - value.rejectedCount !== value.normalizedCount) {
    ctx.addIssue({ code: "custom", path: ["rejectedCount"], message: "Normalization count mismatch" });
  }
  for (const item of value.items) {
    if (!value.sources.some((source) => item.sourceRefs.some((ref) => ref.source === source.source.replace("-search", "")))) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Item has no matching source run" });
      break;
    }
  }
  for (const source of value.sources) {
    const refSource = source.source === "github-search" ? "github" : source.source;
    if (source.itemCount !== value.items.filter((item) => item.sourceRefs.some((ref) => ref.source === refSource)).length) {
      ctx.addIssue({ code: "custom", path: ["sources"], message: "Source item count mismatch" });
    }
  }
});
// v1 原样解析历史 GitHub 批次；新发布只写 v2。
export const LatestSchema = z.union([LegacyLatestSchema, MultiSourceLatestSchema]);
export type Latest = z.infer<typeof LatestSchema>;

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  latestDate: DaySchema,
  latestAsOf: UtcTimestampSchema,
  itemCount: z.number().int().nonnegative(),
  dates: z.array(DaySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const LegacySourceStatusSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.literal("github-search"),
  status: z.enum(["success", "empty", "partial", "failed", "schema_failed", "anomaly"]),
  lastAttemptAt: UtcTimestampSchema,
  lastSuccessAt: UtcTimestampSchema.nullable(),
  receivedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  errorCodes: z.array(z.string()),
});
export const MultiSourceStatusSchema = z.strictObject({ schemaVersion: z.literal(2), sources: z.array(SourceRunSchema) });
export const SourceStatusSchema = z.union([LegacySourceStatusSchema, MultiSourceStatusSchema]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

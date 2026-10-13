import { z } from "zod";
import { IntelligenceItemSchema } from "./intelligence-item";
import { UtcTimestampSchema } from "./primitives";

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LatestSchema = z.strictObject({
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
export type Latest = z.infer<typeof LatestSchema>;

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  latestDate: DaySchema,
  latestAsOf: UtcTimestampSchema,
  itemCount: z.number().int().nonnegative(),
  dates: z.array(DaySchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const SourceStatusSchema = z.strictObject({
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
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

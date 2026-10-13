import { z } from "zod";
import type { HttpClient } from "./http";
import { JsonValueSchema } from "./json";
import { UtcTimestampSchema, WebUrlSchema } from "./primitives";
import { RawItemSchema } from "./raw-item";

export const CollectorIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const HttpClientSchema = z.custom<HttpClient>(
  (value) => typeof value === "object" && value !== null && typeof (value as HttpClient).get === "function",
);

export const CollectorContextSchema = z.strictObject({
  // asOf 由整个运行统一提供，Collector 不自行决定业务时间。
  asOf: UtcTimestampSchema,
  windowStart: UtcTimestampSchema,
  windowEnd: UtcTimestampSchema,
  cursor: JsonValueSchema.nullable(),
  http: HttpClientSchema,
}).refine((context) => context.windowStart <= context.windowEnd, {
  path: ["windowEnd"],
  message: "windowEnd must not precede windowStart",
});

export type CollectorContext = z.infer<typeof CollectorContextSchema>;

export const CollectorErrorSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string().min(1),
  url: WebUrlSchema.optional(),
  retryable: z.boolean(),
});

export type CollectorError = z.infer<typeof CollectorErrorSchema>;

export const CollectorResultSchema = z.strictObject({
  collectorId: CollectorIdSchema,
  status: z.enum(["success", "partial", "failed"]),
  items: z.array(RawItemSchema),
  // receivedCount 包含无法形成 RawItem 的候选记录；acceptedCount 必须等于 items.length。
  receivedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  // nextCursor 只是建议值，只有后续 Pipeline 全部验证、保存且 Commit 成功才能推进。
  nextCursor: JsonValueSchema.nullable(),
  startedAt: UtcTimestampSchema,
  finishedAt: UtcTimestampSchema,
  errors: z.array(CollectorErrorSchema),
}).superRefine((result, context) => {
  if (result.acceptedCount !== result.items.length) {
    context.addIssue({ code: "custom", path: ["acceptedCount"], message: "acceptedCount must equal items.length" });
  }
  if (result.receivedCount < result.acceptedCount) {
    context.addIssue({ code: "custom", path: ["receivedCount"], message: "receivedCount must cover acceptedCount" });
  }
  if (result.startedAt > result.finishedAt) {
    context.addIssue({ code: "custom", path: ["finishedAt"], message: "finishedAt must not precede startedAt" });
  }
  if (result.status === "success" && result.errors.length > 0) {
    context.addIssue({ code: "custom", path: ["errors"], message: "success must not contain errors" });
  }
  if (result.status !== "success" && result.errors.length === 0) {
    context.addIssue({ code: "custom", path: ["errors"], message: "partial and failed require an error" });
  }
  if (result.status === "failed" && (result.items.length > 0 || result.nextCursor !== null)) {
    context.addIssue({ code: "custom", path: ["status"], message: "failed cannot accept items or advance a cursor" });
  }
});

export type CollectorResult = z.infer<typeof CollectorResultSchema>;

export interface Collector {
  readonly id: string;
  readonly source: string;
  collect(context: CollectorContext): Promise<CollectorResult>;
}

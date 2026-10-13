import { z } from "zod";
import { JsonObjectSchema } from "./json";
import { SourceTypeSchema, UtcTimestampSchema, WebUrlSchema } from "./primitives";

// RawItem 只保留重算所需的来源事实；data 不应放入网页全文、Token 或评分与分类结果。
export const RawItemSchema = z.strictObject({
  source: z.string().min(1),
  sourceType: SourceTypeSchema,
  externalId: z.string().min(1).nullable(),
  url: WebUrlSchema,
  collectedAt: UtcTimestampSchema,
  data: JsonObjectSchema,
});

export type RawItem = z.infer<typeof RawItemSchema>;

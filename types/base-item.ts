import { z } from "zod";
import { JsonObjectSchema } from "./json";
import { SourceTypeSchema, UtcTimestampSchema, WebUrlSchema } from "./primitives";

const nonEmptyText = z.string().min(1);

export const SourceRefSchema = z.strictObject({
  source: nonEmptyText,
  externalId: nonEmptyText.nullable(),
  url: WebUrlSchema,
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ContentTypeSchema = z.enum([
  "news",
  "repository",
  "paper",
  "product",
  "startup",
  "funding",
  "job",
  "company_update",
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

// Normalize 与最终条目共用事实字段；分类和评分只在后续阶段添加。
export const BaseItemSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: nonEmptyText,
  title: nonEmptyText,
  url: WebUrlSchema,
  canonicalUrl: WebUrlSchema,
  source: nonEmptyText,
  sourceType: SourceTypeSchema,
  sourceRefs: z.array(SourceRefSchema).min(1),
  contentType: ContentTypeSchema,
  publishedAt: UtcTimestampSchema.nullable(),
  firstSeenAt: UtcTimestampSchema,
  collectedAt: UtcTimestampSchema,
  metadata: JsonObjectSchema,
});

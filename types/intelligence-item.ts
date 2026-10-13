import { z } from "zod";
import { JsonObjectSchema } from "./json";

const nonEmptyText = z.string().min(1);
const webUrl = z.url({ protocol: /^https?$/ });
const canonicalId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const score = z.number().finite().min(0).max(100);

const utcTimestamp = z.iso.datetime({ precision: 3 }).refine(
  (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
  { message: "Expected a real ISO 8601 UTC timestamp with milliseconds" },
);

export const SourceRefSchema = z.strictObject({
  source: nonEmptyText,
  externalId: nonEmptyText.nullable(),
  url: webUrl,
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ScoreBreakdownSchema = z.strictObject({
  // 五项是最终 0–100 分中的实际贡献点数；Ranking Task 负责计算，不在此实现算法。
  topic: score,
  source: score,
  freshness: score,
  popularity: score,
  novelty: score,
  // 偏好版本说明按哪版 Profile 评分；asOf 固定同一轮评分的计算时点。
  profileVersion: nonEmptyText,
  asOf: utcTimestamp,
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

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

export const IntelligenceItemSchema = z
  .strictObject({
    // schemaVersion 只记录数据结构版本，不随用户兴趣或评分权重改变。
    schemaVersion: z.literal(1),
    id: nonEmptyText,
    title: nonEmptyText,
    url: webUrl,
    canonicalUrl: webUrl,
    source: nonEmptyText,
    sourceType: z.enum(["api", "rss", "sitemap", "html"]),
    // 合并多个发现渠道时保留每个来源的证据链接。
    sourceRefs: z.array(SourceRefSchema).min(1),
    contentType: ContentTypeSchema,
    // 来源没有可信发布时间时保持 null，不能把 Sitemap lastmod 当作发布时间。
    publishedAt: utcTimestamp.nullable(),
    // firstSeenAt 是首次发现时间；collectedAt 是当前采集运行的时间。
    firstSeenAt: utcTimestamp,
    collectedAt: utcTimestamp,
    topics: z.array(canonicalId),
    companies: z.array(canonicalId),
    popularityScore: score,
    personalScore: score,
    scoreBreakdown: ScoreBreakdownSchema,
    metadata: JsonObjectSchema,
  })
  .refine(
    (item) =>
      Math.abs(
        item.personalScore -
          (item.scoreBreakdown.topic +
            item.scoreBreakdown.source +
            item.scoreBreakdown.freshness +
            item.scoreBreakdown.popularity +
            item.scoreBreakdown.novelty),
      ) <= 1e-6,
    { path: ["scoreBreakdown"], message: "Contributions must sum to personalScore" },
  );

// IntelligenceItem 由唯一的运行时 Schema 推导，不再维护一份平行 Interface。
export type IntelligenceItem = z.infer<typeof IntelligenceItemSchema>;

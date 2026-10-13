import { z } from "zod";
import { rankingWeights } from "../lib/ranking-weights";
import { JsonObjectSchema } from "./json";
import { SourceTypeSchema, UtcTimestampSchema, WebUrlSchema } from "./primitives";

const nonEmptyText = z.string().min(1);
const canonicalId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const scoreMaximum = 100;
const score = z.number().finite().min(0).max(scoreMaximum);
const contributionScore = (weight: number) => score.max(weight * scoreMaximum);

export const SourceRefSchema = z.strictObject({
  source: nonEmptyText,
  externalId: nonEmptyText.nullable(),
  url: WebUrlSchema,
});

export type SourceRef = z.infer<typeof SourceRefSchema>;

export const ScoreBreakdownSchema = z.strictObject({
  // 五项是加权后的实际贡献点数；每项上限由同一份 Ranking 权重换算，评分算法留待后续 Task。
  topic: contributionScore(rankingWeights.topic),
  source: contributionScore(rankingWeights.source),
  freshness: contributionScore(rankingWeights.freshness),
  popularity: contributionScore(rankingWeights.popularity),
  novelty: contributionScore(rankingWeights.novelty),
  // 偏好版本说明按哪版 Profile 评分；asOf 固定同一轮评分的计算时点。
  profileVersion: nonEmptyText,
  asOf: UtcTimestampSchema,
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
    url: WebUrlSchema,
    canonicalUrl: WebUrlSchema,
    source: nonEmptyText,
    sourceType: SourceTypeSchema,
    // 合并多个发现渠道时保留每个来源的证据链接。
    sourceRefs: z.array(SourceRefSchema).min(1),
    contentType: ContentTypeSchema,
    // 来源没有可信发布时间时保持 null，不能把 Sitemap lastmod 当作发布时间。
    publishedAt: UtcTimestampSchema.nullable(),
    // firstSeenAt 是首次发现时间；collectedAt 是当前采集运行的时间。
    firstSeenAt: UtcTimestampSchema,
    collectedAt: UtcTimestampSchema,
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

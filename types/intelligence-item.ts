import { z } from "zod";
import { rankingWeights } from "../lib/ranking-weights";
import { BaseItemSchema } from "./base-item";
import { UtcTimestampSchema } from "./primitives";

export { SourceRefSchema, ContentTypeSchema } from "./base-item";
export type { SourceRef, ContentType } from "./base-item";

const nonEmptyText = z.string().min(1);
const canonicalId = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const scoreMaximum = 100;
const score = z.number().finite().min(0).max(scoreMaximum);
const contributionScore = (weight: number) => score.max(weight * scoreMaximum);

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

export const IntelligenceItemSchema = BaseItemSchema
  .safeExtend({
    topics: z.array(canonicalId),
    companies: z.array(canonicalId),
    popularityScore: score,
    personalScore: score,
    scoreBreakdown: ScoreBreakdownSchema,
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

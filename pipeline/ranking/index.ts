import { profile } from "../../config/profile";
import { rankingWeights } from "../../lib/ranking-weights";
import { IntelligenceItemSchema, type IntelligenceItem } from "../../types/intelligence-item";
import { UtcTimestampSchema } from "../../types/primitives";
import type { ClassifiedItem } from "../classification";

const DAY_MS = 86_400_000;
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const round = (value: number) => Math.round(value * 10_000) / 10_000;

function metric(value: unknown): number {
  // GitHub Normalizer 必须提供真实数值；缺失不是观测到的 0。
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Missing or invalid GitHub popularity metric");
  }
  return value;
}

export function popularityScore(item: ClassifiedItem): number {
  if (item.source === "hacker-news") {
    // HN Points/Comments 与 GitHub Stars/Forks 分别归一化，不混用量纲。
    const points = metric(item.metadata.points ?? 0);
    const comments = metric(item.metadata.comments ?? 0);
    return round(clamp(70 * Math.log1p(points) / Math.log1p(1000) + 30 * Math.log1p(comments) / Math.log1p(300)));
  }
  if (item.contentType !== "repository") return 0; // arXiv/Sitemap 无可比较热度事实。
  // 固定对数锚点，避免当天搜索样本变化导致同一仓库的分数漂移。
  const stars = metric(item.metadata.stars);
  const forks = metric(item.metadata.forks);
  return round(clamp(70 * Math.log1p(stars) / Math.log1p(10_000)
    + 30 * Math.log1p(forks) / Math.log1p(1_000)));
}

function freshnessScore(item: ClassifiedItem, asOfMs: number): number {
  const observed = item.contentType === "repository" ? item.metadata.lastPushedAt
    : item.contentType === "job" ? item.metadata.updatedAt : item.publishedAt;
  if (typeof observed !== "string" || !UtcTimestampSchema.safeParse(observed).success) return 0;
  const age = (asOfMs - Date.parse(observed)) / DAY_MS;
  if (age < 0) return 0;
  if (age <= 1) return 100;
  if (age <= 7) return 75;
  if (age <= 30) return 45;
  if (age <= 90) return 20;
  return 5;
}

function noveltyScore(item: ClassifiedItem, asOfMs: number): number {
  const age = (asOfMs - Date.parse(item.firstSeenAt)) / DAY_MS;
  if (age < 0) return 0;
  if (age <= 1) return 80; // 初次观测不等于项目刚发布。
  if (age <= 7) return 60;
  if (age <= 30) return 30;
  return 10;
}

export function rankItem(item: ClassifiedItem, asOf: string): IntelligenceItem {
  UtcTimestampSchema.parse(asOf);
  const asOfMs = Date.parse(asOf);
  const priority = item.topics.map((id) => profile.topics.find((topic) => topic.id === id)?.priority);
  const base = priority.includes("high") ? 90 : priority.includes("medium") ? 60
    : priority.includes("low") ? 25 : 0;
  const topic = Math.min(100, base + Math.min(10, Math.max(0, item.topics.length - 1) * 5));
  // GitHub API 可靠地提供仓库元数据，但不认证第三方项目的主张。
  // 官方站点认证的是文章出处，不代表文章描述的第三方项目获官方认证。
  const source = item.source === "github" && item.sourceType === "api" ? 80
    : item.source === "arxiv" ? 75 : item.source === "hacker-news" ? 65
    : ["openai", "anthropic"].includes(item.source) ? 90
    : item.source === "anthropic-jobs" ? 85 : 0;
  const freshness = freshnessScore(item, asOfMs);
  const popularity = popularityScore(item);
  const novelty = noveltyScore(item, asOfMs);
  const scoreBreakdown = {
    topic: round(topic * rankingWeights.topic),
    source: round(source * rankingWeights.source),
    freshness: round(freshness * rankingWeights.freshness),
    popularity: round(popularity * rankingWeights.popularity),
    novelty: round(novelty * rankingWeights.novelty),
    profileVersion: profile.version,
    asOf,
  };
  const personalScore = round(scoreBreakdown.topic + scoreBreakdown.source +
    scoreBreakdown.freshness + scoreBreakdown.popularity + scoreBreakdown.novelty);
  return IntelligenceItemSchema.parse({
    ...item,
    popularityScore: popularity,
    personalScore,
    scoreBreakdown,
  });
}

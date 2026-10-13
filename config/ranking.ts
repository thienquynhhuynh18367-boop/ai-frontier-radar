// 唯一的初始权重来源。这里只声明比例；评分计算留给后续 Ranking Task。
export const rankingWeights = {
  topic: 0.35,
  source: 0.2,
  freshness: 0.2,
  popularity: 0.15,
  novelty: 0.1,
} as const;

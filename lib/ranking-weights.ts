// 纯权重常量供业务配置与底层 Schema 共用，避免两层互相导入形成循环依赖。
export const rankingWeights = {
  topic: 0.35,
  source: 0.2,
  freshness: 0.2,
  popularity: 0.15,
  novelty: 0.1,
} as const;

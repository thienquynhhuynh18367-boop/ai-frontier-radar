import { z } from "zod";

export const SourceTypeSchema = z.enum(["api", "rss", "sitemap", "html"]);
export const WebUrlSchema = z.url({ protocol: /^https?$/ });

// 所有采集和成品时间共用固定毫秒精度的 UTC 契约，拒绝不存在的日期。
export const UtcTimestampSchema = z.iso.datetime({ precision: 3 }).refine(
  (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
  { message: "Expected a real ISO 8601 UTC timestamp with milliseconds" },
);

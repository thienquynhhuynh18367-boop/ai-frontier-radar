import { UtcTimestampSchema } from "../types/primitives";

const DAY_MS = 86_400_000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000;

export type RunWindow = { day: string; asOf: string; windowStart: string; windowEnd: string };

export function resolveRunWindow(options: { day?: string; asOf?: string; now: Date }): RunWindow {
  const nowMs = options.now.getTime();
  if (!Number.isFinite(nowMs)) throw new Error("Invalid current time");
  const asOf = options.asOf ?? options.now.toISOString();
  UtcTimestampSchema.parse(asOf);
  const asOfMs = Date.parse(asOf);
  // 不允许未来 asOf。零秒容差避免采集时间、首次发现及健康时间被提前。
  if (asOfMs > nowMs) throw new Error("--as-of cannot be later than current UTC time");
  const today = new Date(nowMs + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
  const day = options.day ?? new Date(Date.parse(today + "T00:00:00.000Z") - DAY_MS).toISOString().slice(0, 10);
  const utcMidnight = Date.parse(day + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(utcMidnight) ||
    new Date(utcMidnight).toISOString().slice(0, 10) !== day) throw new Error("Invalid --date");
  const windowStart = new Date(utcMidnight - SHANGHAI_OFFSET_MS).toISOString();
  const windowEnd = new Date(utcMidnight + DAY_MS - SHANGHAI_OFFSET_MS).toISOString();
  if (asOfMs < Date.parse(windowEnd)) throw new Error("Window must be completed by --as-of");
  return { day, asOf, windowStart, windowEnd };
}

export function assertPublishableRun(window: RunWindow, now: Date, latestDate: string | null): void {
  if (latestDate && window.day < latestDate) {
    throw new Error("Historical run cannot replace a newer latest; use an existing Raw snapshot for offline replay");
  }
  // 在线采集的 RawItem、firstSeenAt 和健康时间取同一个 asOf；旧计算时点不能冒充真实采集时刻。
  if (Date.parse(window.asOf) < now.getTime() - 60_000) {
    throw new Error("Published collection --as-of must match actual run time");
  }
}

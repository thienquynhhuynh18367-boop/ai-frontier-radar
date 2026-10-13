export const STALE_AFTER_MS = 48 * 60 * 60 * 1_000;

export function isDataStale(asOf: string, now: string): boolean {
  const age = Date.parse(now) - Date.parse(asOf);
  return !Number.isFinite(age) || age > STALE_AFTER_MS;
}

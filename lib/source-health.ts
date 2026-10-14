import type { SourceRun, SourceStatus } from "../types/publication";

export function sourceRuns(health: SourceStatus | null): SourceRun[] {
  if (!health) return [];
  if (health.schemaVersion === 2) return health.sources;
  return [{ ...health, carriedCount: 0, consecutiveFailures: health.status === "success" ? 0 : 1, queryStats: [] }];
}

export function overallHealth(health: SourceStatus | null): "success" | "empty" | "partial" | "unknown" {
  const runs = sourceRuns(health);
  if (!runs.length) return "unknown";
  if (runs.every((run) => run.status === "success" || run.status === "empty")) {
    return runs.every((run) => run.status === "empty") ? "empty" : "success";
  }
  return "partial";
}

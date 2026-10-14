import { z } from "zod";
import { CollectorContextSchema, CollectorResultSchema, type Collector, type CollectorContext, type CollectorError } from "../../types/collector";
import { RawItemSchema, type RawItem } from "../../types/raw-item";

const ENDPOINT = "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs";
const role = /\b(?:product manager|forward deployed|fde|applied ai)\b/i;
const JobSchema = z.object({ id: z.number().int().positive(), title: z.string().min(1),
  updated_at: z.string().min(1), absolute_url: z.url(), location: z.object({ name: z.string() }).optional() });
const ResponseSchema = z.object({ jobs: z.array(z.unknown()) });

export class AnthropicJobsCollector implements Collector {
  readonly id = "anthropic-jobs";
  readonly source = "anthropic-jobs";
  readonly queryStats: { id: string; received: number; accepted: number; rejected: number; requests: number }[] = [];
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async collect(context: CollectorContext) {
    CollectorContextSchema.parse(context);
    const startedAt = this.now();
    const stat = { id: "ai-pm-fde-applied-ai", received: 0, accepted: 0, rejected: 0, requests: 1 };
    this.queryStats.length = 0; this.queryStats.push(stat);
    const errors: CollectorError[] = [];
    const items: RawItem[] = [];
    try {
      const response = await context.http.get(ENDPOINT, { timeoutMs: 30_000 });
      const parsed = ResponseSchema.parse(JSON.parse(response.body) as unknown);
      for (const value of parsed.jobs) {
        stat.received++;
        const job = JobSchema.safeParse(value);
        if (!job.success || !role.test(job.data.title) || !Number.isFinite(Date.parse(job.data.updated_at)) ||
          Date.parse(job.data.updated_at) < Date.parse(context.windowStart) ||
          Date.parse(job.data.updated_at) >= Date.parse(context.windowEnd)) { stat.rejected++; continue; }
        const url = new URL(job.data.absolute_url);
        if (url.protocol !== "https:" || url.hostname !== "job-boards.greenhouse.io" ||
          url.pathname !== `/anthropic/jobs/${job.data.id}`) { stat.rejected++; continue; }
        items.push(RawItemSchema.parse({ source: this.source, sourceType: "api", externalId: String(job.data.id),
          url: url.origin + url.pathname, collectedAt: context.asOf,
          data: { title: job.data.title, location: job.data.location?.name ?? null,
            updatedAt: new Date(job.data.updated_at).toISOString() } }));
        stat.accepted++;
      }
    } catch {
      errors.push({ code: "anthropic-jobs-request-failed", message: "Anthropic public job board failed", retryable: false });
    }
    return CollectorResultSchema.parse({ collectorId: this.id, status: errors.length ? "failed" : "success",
      items: errors.length ? [] : items, receivedCount: stat.received, acceptedCount: errors.length ? 0 : items.length,
      nextCursor: null, startedAt, finishedAt: this.now(), errors });
  }
}

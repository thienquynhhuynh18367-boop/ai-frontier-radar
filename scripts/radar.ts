import { GitHubSearchCollector, type GitHubPageDiagnostic } from "../collectors/github/search";
import { HackerNewsCollector } from "../collectors/hacker-news/search";
import { ArxivCollector } from "../collectors/arxiv/search";
import { OfficialSitemapCollector } from "../collectors/official/sitemap";
import { AnthropicJobsCollector } from "../collectors/anthropic-jobs/search";
import { githubSearchQueries } from "../config/sources/github-search";
import { readFirstSeenByItemId, readLatest, publishMultiSource, recordMultiFailure } from "../lib/data-store";
import { FetchHttpClient } from "../lib/http-client";
import { processMultiSource, type SourceBatch } from "../pipeline/multi-source";
import { CollectorResultSchema, type Collector, type CollectorResult } from "../types/collector";
import { UtcTimestampSchema } from "../types/primitives";
import type { HttpClient } from "../types/http";

const DAY_MS = 86_400_000;

function pacedHttpClient(client: HttpClient): HttpClient {
  let nextAt = 0;
  return {
    async get(url, options) {
      // 匿名 Search API 请求在 CLI 层低频发送；Collector 的查询和过滤策略不变。
      const delay = Math.max(0, nextAt - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      nextAt = Date.now() + 9_000;
      return client.get(url, options);
    },
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function dayWindow(day: string): { start: string; end: string } {
  const utcMidnight = Date.parse(day + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(utcMidnight) ||
    new Date(utcMidnight).toISOString().slice(0, 10) !== day) throw new Error("Invalid --date");
  return {
    start: new Date(utcMidnight - 8 * 60 * 60 * 1_000).toISOString(),
    end: new Date(utcMidnight + 16 * 60 * 60 * 1_000).toISOString(),
  };
}

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  const diagnose = process.argv.includes("--diagnose");
  const asOf = argument("--as-of") ?? new Date().toISOString();
  UtcTimestampSchema.parse(asOf);
  const shanghaiDay = new Date(Date.parse(asOf) + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const defaultDay = new Date(Date.parse(shanghaiDay + "T00:00:00.000Z") - DAY_MS).toISOString().slice(0, 10);
  const day = argument("--date") ?? defaultDay;
  const window = dayWindow(day);
  if (Date.parse(asOf) < Date.parse(window.end)) throw new Error("Window must be completed by --as-of");
  const root = process.cwd();
  const previous = diagnose ? null : await readLatest(root);
  const queryDiagnostics: GitHubPageDiagnostic[] = [];
  const collector = new GitHubSearchCollector({
    token: process.env.GITHUB_TOKEN || undefined,
    ...(smoke ? { queries: [githubSearchQueries.find((query) => query.id === "mcp")!], perPage: 10 } : {}),
    onPageDiagnostic: (entry: GitHubPageDiagnostic) => queryDiagnostics.push(entry),
  });
  const started = Date.now();
  if (!diagnose) {
    const collectors: (Collector & { queryStats?: SourceBatch["queryStats"] })[] = [
      collector,
      new HackerNewsCollector(smoke ? { queries: ["MCP"], perPage: 10 } : {}),
      new ArxivCollector({ maxResults: smoke ? 10 : 100 }),
      new OfficialSitemapCollector("openai", smoke ? { maxSections: 1 } : {}),
      new OfficialSitemapCollector("anthropic"),
      new AnthropicJobsCollector(),
    ];
    const batches: SourceBatch[] = [];
    const rawResults = new Map<string, CollectorResult>();
    for (const source of collectors) {
      let result: CollectorResult;
      try {
        result = await source.collect({ asOf, windowStart: window.start, windowEnd: window.end, cursor: null,
          http: source.id === "github-search" ? pacedHttpClient(new FetchHttpClient()) : new FetchHttpClient() });
      } catch {
        result = CollectorResultSchema.parse({ collectorId: source.id, status: "failed", items: [],
          receivedCount: 0, acceptedCount: 0, nextCursor: null, startedAt: asOf, finishedAt: asOf,
          errors: [{ code: `${source.id}-unexpected-failure`, message: `${source.id} failed`, retryable: false }] });
      }
      rawResults.set(source.id, result);
      batches.push({ id: source.id as SourceBatch["id"], result,
        queryStats: source.id === "github-search" ? queryDiagnostics.map((entry) => ({ id: `${entry.queryId}:page-${entry.page}`,
          received: entry.received, accepted: entry.accepted,
          rejected: entry.received - entry.accepted, requests: 1 })) : source.queryStats ?? [] });
    }
    const seen = smoke ? new Map<string, string>() : await readFirstSeenByItemId(root, asOf);
    const processed = processMultiSource(batches, day, asOf, smoke ? null : previous, seen);
    if ("latest" in processed) {
      if (!smoke) await publishMultiSource(root, processed.latest, rawResults);
      process.stdout.write(JSON.stringify({ mode: smoke ? "smoke" : "run", status: processed.status,
        date: day, receivedCount: processed.latest.receivedCount, acceptedCount: processed.latest.acceptedCount,
        itemCount: processed.latest.itemCount, sources: processed.latest.sources,
        durationMs: Date.now() - started, published: !smoke }) + "\n");
      return;
    }
    if (!smoke) await recordMultiFailure(root, processed.sources);
    process.stdout.write(JSON.stringify({ mode: smoke ? "smoke" : "run", status: processed.status,
      date: day, sources: processed.sources, errorCodes: processed.errorCodes,
      durationMs: Date.now() - started, published: false }) + "\n");
    process.exitCode = 1;
    return;
  }
  const result = await collector.collect({
    asOf, windowStart: window.start, windowEnd: window.end, cursor: null,
    http: pacedHttpClient(new FetchHttpClient()),
  });
  process.stdout.write(JSON.stringify({
    mode: "diagnose", date: day, collectorStatus: result.status,
    receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
    queryDiagnostics, errorCodes: result.errors.map((error) => error.code),
    durationMs: Date.now() - started, published: false,
  }) + "\n");
  if (result.status !== "success") process.exitCode = 1;
}

main().catch(() => {
  // 未知异常不输出原始 message/stack，避免环境变量或请求信息进入日志。
  process.stderr.write("Radar run failed before publication; previous latest was preserved.\n");
  process.exitCode = 1;
});

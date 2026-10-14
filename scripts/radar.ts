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
import type { HttpClient } from "../types/http";
import { assertPublishableRun, resolveRunWindow } from "../lib/run-window";

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

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  const diagnose = process.argv.includes("--diagnose");
  const now = new Date();
  const window = resolveRunWindow({ day: argument("--date"),
    asOf: argument("--as-of"), now });
  const { day, asOf, windowStart, windowEnd } = window;
  const root = process.cwd();
  const previous = diagnose ? null : await readLatest(root);
  if (!smoke && !diagnose) assertPublishableRun(window, now, previous?.date ?? null);
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
        result = await source.collect({ asOf, windowStart, windowEnd, cursor: null,
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
    asOf, windowStart, windowEnd, cursor: null,
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

main().catch((error: unknown) => {
  // 只输出本地静态校验文案；未知异常不含原始 message/stack，避免泄露请求信息。
  const safeReasons = new Set(["--as-of cannot be later than current UTC time", "Window must be completed by --as-of",
    "Historical run cannot replace a newer latest; use an existing Raw snapshot for offline replay",
    "Published collection --as-of must match actual run time", "Invalid --date", "Invalid current time"]);
  const reason = error instanceof Error && safeReasons.has(error.message) ? ` ${error.message}.` : "";
  process.stderr.write(`Radar run failed before publication; previous latest was preserved.${reason}\n`);
  process.exitCode = 1;
});

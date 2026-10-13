import { GitHubSearchCollector, type GitHubPageDiagnostic } from "../collectors/github/search";
import { githubSearchQueries } from "../config/sources/github-search";
import { readFirstSeenHistory, readLatest, publishCollection, recordFailure } from "../lib/data-store";
import { FetchHttpClient } from "../lib/http-client";
import { processGitHubCollection } from "../pipeline/run";
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
  const history = diagnose ? new Map<string, string>() : await readFirstSeenHistory(root, asOf);
  const queryDiagnostics: GitHubPageDiagnostic[] = [];
  const collector = new GitHubSearchCollector({
    token: process.env.GITHUB_TOKEN || undefined,
    ...(smoke ? { queries: [githubSearchQueries.find((query) => query.id === "mcp")!], perPage: 10 } : {}),
    ...(diagnose ? { onPageDiagnostic: (entry: GitHubPageDiagnostic) => queryDiagnostics.push(entry) } : {}),
  });
  const started = Date.now();
  const result = await collector.collect({
    asOf, windowStart: window.start, windowEnd: window.end, cursor: null,
    http: pacedHttpClient(new FetchHttpClient()),
  });
  if (diagnose) {
    process.stdout.write(JSON.stringify({
      mode: "diagnose", date: day, collectorStatus: result.status,
      receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
      queryDiagnostics, errorCodes: result.errors.map((error) => error.code),
      durationMs: Date.now() - started, published: false,
    }) + "\n");
    if (result.status !== "success") process.exitCode = 1;
    return;
  }
  const processed = processGitHubCollection(result, day, asOf, history, smoke ? 0 : previous?.itemCount ?? 0);
  if (processed.status !== "success") {
    if (!smoke) await recordFailure(root, previous, processed.status, asOf, result, processed.errorCodes);
    process.stdout.write(JSON.stringify({
      mode: smoke ? "smoke" : "run", status: processed.status, date: day,
      receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
      itemCount: 0, durationMs: Date.now() - started, errorCodes: processed.errorCodes,
      published: false,
    }) + "\n");
    process.exitCode = 1;
    return;
  }
  if (!smoke) await publishCollection(root, processed.latest, result);
  process.stdout.write(JSON.stringify({
    mode: smoke ? "smoke" : "run", status: "success", date: day,
    receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
    itemCount: processed.latest.itemCount, duplicateCount: processed.latest.duplicateCount,
    durationMs: Date.now() - started, published: !smoke,
  }) + "\n");
}

main().catch(() => {
  // 未知异常不输出原始 message/stack，避免环境变量或请求信息进入日志。
  process.stderr.write("Radar run failed before publication; previous latest was preserved.\n");
  process.exitCode = 1;
});

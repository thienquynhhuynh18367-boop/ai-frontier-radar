import {
  githubSearchQueries,
  githubSearchRequestConfig,
  type GitHubSearchQuery,
} from "../../config/sources/github-search";
import { HttpError } from "../../lib/http-client";
import {
  CollectorContextSchema,
  CollectorResultSchema,
  type Collector,
  type CollectorContext,
  type CollectorError,
  type CollectorResult,
} from "../../types/collector";
import { RawItemSchema, type RawItem } from "../../types/raw-item";
import { GitHubRepositorySchema, GitHubSearchResponseSchema, type GitHubRepository } from "./schemas";

const ENDPOINT = "https://api.github.com/search/repositories";
const API_VERSION = "2026-03-10";

export type GitHubSearchCollectorOptions = {
  readonly token?: string;
  readonly queries?: readonly GitHubSearchQuery[];
  readonly perPage?: number;
  readonly maxPagesPerQuery?: number;
  readonly now?: () => string;
  readonly onPageDiagnostic?: (diagnostic: GitHubPageDiagnostic) => void;
};

// 只报告数量与查询 ID，不记录响应正文、URL 或认证信息。
export type GitHubPageDiagnostic = {
  queryId: string; page: number; totalCount: number; received: number;
  invalid: number; private: number; archived: number; fork: number;
  missingPushedAt: number; beforeWindow: number; afterWindow: number;
  accepted: number; overlap: number;
};

type Match = { repository: GitHubRepository; queryIds: Set<string> };

function searchUrl(query: GitHubSearchQuery, context: CollectorContext, perPage: number, page: number): string {
  const url = new URL(ENDPOINT);
  // pushed 日期只缩小 API 搜索范围；毫秒级半开窗口在本地再验证。
  const pushed = `pushed:${context.windowStart.slice(0, 10)}..${context.windowEnd.slice(0, 10)}`;
  url.search = new URLSearchParams({
    q: `${query.query} is:public archived:false fork:false ${pushed}`,
    sort: githubSearchRequestConfig.sort,
    order: githubSearchRequestConfig.order,
    per_page: String(perPage),
    page: String(page),
  }).toString();
  return url.toString();
}

function requestError(error: unknown, queryId: string, page: number): CollectorError {
  if (error instanceof HttpError) {
    let safeUrl: string | undefined;
    try {
      safeUrl = new URL(error.url).origin;
    } catch {
      // 未知 HttpClient 可能给出非 URL；CollectorError 不保留它。
    }
    return {
      code: error.code,
      message: `GitHub Search query ${queryId} page ${page}: ${error.message}`,
      ...(safeUrl ? { url: safeUrl } : {}),
      retryable: error.retryable,
    };
  }
  // 不读取未知异常的 message、stack 或原始响应，避免泄露 Header 和 Token。
  return {
    code: "github-search-request-failed",
    message: `GitHub Search query ${queryId} page ${page} failed`,
    retryable: false,
  };
}

function toRawItem(match: Match, collectedAt: string): RawItem {
  const repo = match.repository;
  return RawItemSchema.parse({
    source: "github",
    sourceType: "api",
    externalId: String(repo.id),
    url: repo.html_url,
    collectedAt,
    data: {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      owner: { login: repo.owner.login },
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      language: repo.language,
      topics: repo.topics,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      archived: repo.archived,
      fork: repo.fork,
      private: repo.private,
      default_branch: repo.default_branch,
      matched_query_ids: [...match.queryIds].sort(),
    },
  });
}

export class GitHubSearchCollector implements Collector {
  readonly id = "github-search";
  readonly source = "github";

  private readonly token?: string;
  private readonly queries: readonly GitHubSearchQuery[];
  private readonly perPage: number;
  private readonly maxPagesPerQuery: number;
  private readonly now: () => string;
  private readonly onPageDiagnostic?: (diagnostic: GitHubPageDiagnostic) => void;

  constructor(options: GitHubSearchCollectorOptions = {}) {
    this.token = options.token;
    this.queries = options.queries ?? githubSearchQueries;
    this.perPage = options.perPage ?? githubSearchRequestConfig.perPage;
    this.maxPagesPerQuery = options.maxPagesPerQuery ?? githubSearchRequestConfig.maxPagesPerQuery;
    this.now = options.now ?? (() => new Date().toISOString());
    this.onPageDiagnostic = options.onPageDiagnostic;

    if (!Number.isInteger(this.perPage) || this.perPage < 1 || this.perPage > 100) {
      throw new Error("perPage must be an integer from 1 to 100");
    }
    if (!Number.isInteger(this.maxPagesPerQuery) || this.maxPagesPerQuery < 1 || this.maxPagesPerQuery > 20) {
      throw new Error("maxPagesPerQuery must be an integer from 1 to 20");
    }
    if (this.queries.length === 0 || new Set(this.queries.map((query) => query.id)).size !== this.queries.length) {
      throw new Error("queries must be nonempty with unique IDs");
    }
    if (this.queries.some((query) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(query.id) || !query.query.trim())) {
      throw new Error("queries must have valid IDs and nonempty query text");
    }
  }

  async collect(context: CollectorContext): Promise<CollectorResult> {
    CollectorContextSchema.parse(context);
    const startedAt = this.now();
    const errors: CollectorError[] = [];
    const matches = new Map<string, Match>();
    let receivedCount = 0;
    let completedQueries = 0;
    let rateLimited = false;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": API_VERSION,
    };
    if (this.token !== undefined) headers.Authorization = `Bearer ${this.token}`;

    for (const query of this.queries) {
      let parsedPage = false;
      for (let page = 1; page <= this.maxPagesPerQuery; page += 1) {
        let response;
        try {
          response = await context.http.get(searchUrl(query, context, this.perPage, page), { headers });
        } catch (error) {
          errors.push(requestError(error, query.id, page));
          if (error instanceof HttpError && error.code === "rate_limited") rateLimited = true;
          break;
        }
        if (!response.ok || response.status < 200 || response.status >= 300) {
          errors.push({
            code: "github-search-request-failed",
            message: `GitHub Search query ${query.id} page ${page} returned a non-success status`,
            retryable: false,
          });
          break;
        }

        let body: unknown;
        try {
          body = JSON.parse(response.body);
        } catch {
          errors.push({
            code: "github-search-invalid-json",
            message: `GitHub Search query ${query.id} page ${page} returned invalid JSON`,
            retryable: false,
          });
          break;
        }
        const parsed = GitHubSearchResponseSchema.safeParse(body);
        if (!parsed.success) {
          errors.push({
            code: "github-search-invalid-response",
            message: `GitHub Search query ${query.id} page ${page} returned an invalid response`,
            retryable: false,
          });
          break;
        }

        parsedPage = true;
        const { items, incomplete_results: incomplete } = parsed.data;
        receivedCount += items.length;
        if (incomplete) {
          errors.push({
            code: "github-search-incomplete",
            message: `GitHub Search query ${query.id} page ${page} returned incomplete results`,
            retryable: true,
          });
        }

        const diagnostic: GitHubPageDiagnostic = {
          queryId: query.id, page, totalCount: parsed.data.total_count, received: items.length,
          invalid: 0, private: 0, archived: 0, fork: 0, missingPushedAt: 0,
          beforeWindow: 0, afterWindow: 0, accepted: 0, overlap: 0,
        };
        for (const item of items) {
          const result = GitHubRepositorySchema.safeParse(item);
          if (!result.success) {
            diagnostic.invalid += 1;
            continue;
          }
          const repo = result.data;
          // 带 Token 时仍必须再次排除私有、归档、Fork 与时间窗外条目。
          if (repo.private) { diagnostic.private += 1; continue; }
          if (repo.archived) { diagnostic.archived += 1; continue; }
          if (repo.fork) { diagnostic.fork += 1; continue; }
          if (repo.pushed_at === null) { diagnostic.missingPushedAt += 1; continue; }
          const pushedAt = Date.parse(repo.pushed_at);
          if (pushedAt < Date.parse(context.windowStart)) { diagnostic.beforeWindow += 1; continue; }
          if (pushedAt >= Date.parse(context.windowEnd)) { diagnostic.afterWindow += 1; continue; }

          diagnostic.accepted += 1;

          // 这里只合并同一来源的查询重叠；跨来源 Deduplicate 留给后续 Pipeline。
          const key = String(repo.id);
          const existing = matches.get(key);
          if (existing) { diagnostic.overlap += 1; existing.queryIds.add(query.id); }
          else matches.set(key, { repository: repo, queryIds: new Set([query.id]) });
        }
        // 诊断观察者不能改变 Collector 的成功、失败与发布结果。
        try { this.onPageDiagnostic?.(diagnostic); } catch { /* 诊断失败不影响采集。 */ }
        if (diagnostic.invalid > 0) {
          errors.push({
            code: "github-repository-invalid",
            message: `GitHub Search query ${query.id} page ${page} contained ${diagnostic.invalid} invalid repository items`,
            retryable: false,
          });
        }

        // 配置覆盖范围完成即成功；total_count 超过第一页不是采集错误。
        if (incomplete || items.length < this.perPage || page * this.perPage >= parsed.data.total_count) break;
      }
      if (parsedPage) completedQueries += 1;
      // GitHub 明示限流后不再请求其他 Query，避免继续消耗受限的 Search 额度。
      if (rateLimited) break;
    }

    const status = completedQueries === 0 ? "failed" : errors.length > 0 ? "partial" : "success";
    const items = status === "failed"
      ? []
      : [...matches.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([, match]) => toRawItem(match, context.asOf));
    return CollectorResultSchema.parse({
      collectorId: this.id,
      status,
      items,
      receivedCount,
      acceptedCount: items.length,
      nextCursor: null,
      startedAt,
      finishedAt: this.now(),
      errors,
    });
  }
}

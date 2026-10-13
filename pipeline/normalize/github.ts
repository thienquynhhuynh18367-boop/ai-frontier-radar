import { z, type ZodError } from "zod";
import { GitHubRepositorySchema } from "../../collectors/github/schemas";
import { NormalizedItemSchema, type NormalizedItem } from "../../types/normalized-item";
import { UtcTimestampSchema } from "../../types/primitives";
import { RawItemSchema } from "../../types/raw-item";

const GitHubRawDataSchema = GitHubRepositorySchema.extend({
  matched_query_ids: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
});

export type GitHubNormalizationIssue = { readonly field: string; readonly message: string };
export type GitHubNormalizationResult =
  | { readonly success: true; readonly data: NormalizedItem }
  | { readonly success: false; readonly issues: readonly GitHubNormalizationIssue[] };

export type GitHubNormalizationOptions = { readonly firstSeenAt?: string };

export type GitHubNormalizationBatchResult = {
  readonly items: readonly NormalizedItem[];
  readonly errors: readonly { readonly index: number; readonly issues: readonly GitHubNormalizationIssue[] }[];
};

function failure(field: string, message: string): GitHubNormalizationResult {
  return { success: false, issues: [{ field, message }] };
}

function schemaFailure(error: ZodError, prefix: string): GitHubNormalizationResult {
  // 只暴露字段路径和固定说明，不回传原始对象或可能含敏感信息的输入值。
  return {
    success: false,
    issues: error.issues.map((issue) => ({
      // RawItem.data 可有任意字段名；只报告已知的顶层字段，避免把输入键名当作日志内容。
      field: prefix === "data"
        ? [prefix, ...issue.path.map(String)].join(".")
        : typeof issue.path[0] === "string" &&
            ["source", "sourceType", "externalId", "url", "collectedAt", "data",
              "schemaVersion", "id", "title", "canonicalUrl", "sourceRefs", "contentType",
              "publishedAt", "firstSeenAt", "metadata"].includes(issue.path[0])
          ? issue.path[0]
          : "$",
      message: "Invalid field value",
    })),
  };
}

function canonicalGitHubRepositoryUrl(value: string): string | null {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) ||
      !["github.com", "www.github.com"].includes(url.hostname) ||
      url.username || url.password || url.port) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments.some((segment) => /%(?:2f|5c)/i.test(segment))) return null;
  // 仓库根链接的 query、fragment 和末尾斜杠不决定实体身份；保留原路径大小写。
  return `https://github.com/${segments[0]}/${segments[1]}`;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function safeNormalizeGitHubRawItem(
  input: unknown,
  options: GitHubNormalizationOptions = {},
): GitHubNormalizationResult {
  const rawResult = RawItemSchema.safeParse(input);
  if (!rawResult.success) return schemaFailure(rawResult.error, "");
  const raw = rawResult.data;
  if (raw.source !== "github") return failure("source", "Expected github source");
  if (raw.sourceType !== "api") return failure("sourceType", "Expected API source type");

  const dataResult = GitHubRawDataSchema.safeParse(raw.data);
  if (!dataResult.success) return schemaFailure(dataResult.error, "data");
  const data = dataResult.data;
  if (raw.externalId !== String(data.id)) {
    return failure("externalId", "RawItem externalId must match data.id");
  }
  // 即使上游 Collector 已过滤，Normalizer 仍独立守住公开仓库边界。
  if (data.private) return failure("data.private", "Private repositories are not accepted");
  if (data.archived) return failure("data.archived", "Archived repositories are not accepted");
  if (data.fork) return failure("data.fork", "Fork repositories are not accepted");

  const canonicalUrl = canonicalGitHubRepositoryUrl(raw.url);
  const canonicalDataUrl = canonicalGitHubRepositoryUrl(data.html_url);
  if (canonicalUrl === null) return failure("url", "Expected a GitHub repository URL");
  if (canonicalDataUrl === null || canonicalDataUrl.toLowerCase() !== canonicalUrl.toLowerCase()) {
    return failure("data.html_url", "Repository URL must match RawItem URL");
  }
  let repositoryPath: string;
  try {
    repositoryPath = decodeURIComponent(new URL(canonicalDataUrl).pathname.slice(1));
  } catch {
    return failure("data.html_url", "Repository URL path is invalid");
  }
  if (repositoryPath.toLowerCase() !== data.full_name.toLowerCase() ||
      data.full_name.toLowerCase() !== `${data.owner.login}/${data.name}`.toLowerCase()) {
    return failure("data.full_name", "Repository name must match its owner and URL");
  }

  const firstSeenAt = options.firstSeenAt ?? raw.collectedAt;
  if (!UtcTimestampSchema.safeParse(firstSeenAt).success) {
    return failure("firstSeenAt", "Expected a valid UTC first-seen timestamp");
  }
  if (Date.parse(firstSeenAt) > Date.parse(raw.collectedAt)) {
    return failure("firstSeenAt", "First-seen time cannot follow collection time");
  }

  const normalized = NormalizedItemSchema.safeParse({
    schemaVersion: 1,
    id: `github-repo:${data.id}`,
    title: data.full_name,
    url: raw.url,
    canonicalUrl,
    source: raw.source,
    sourceType: raw.sourceType,
    sourceRefs: [{ source: raw.source, externalId: raw.externalId, url: raw.url }],
    contentType: "repository",
    // 创建或最近推送时间都不能冒充项目正式发布时间。
    publishedAt: null,
    firstSeenAt,
    collectedAt: raw.collectedAt,
    metadata: {
      description: data.description,
      repositoryId: String(data.id),
      fullName: data.full_name,
      owner: data.owner.login,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      language: data.language,
      githubTopics: sortedUnique(data.topics),
      createdAt: new Date(data.created_at).toISOString(),
      updatedAt: new Date(data.updated_at).toISOString(),
      lastPushedAt: data.pushed_at === null ? null : new Date(data.pushed_at).toISOString(),
      defaultBranch: data.default_branch,
      matchedQueryIds: sortedUnique(data.matched_query_ids),
    },
  });
  if (!normalized.success) return schemaFailure(normalized.error, "");
  return { success: true, data: normalized.data };
}

export class GitHubNormalizationError extends Error {
  readonly name = "GitHubNormalizationError";
  readonly issues: readonly GitHubNormalizationIssue[];

  constructor(issues: readonly GitHubNormalizationIssue[]) {
    super("GitHub RawItem normalization failed");
    this.issues = issues;
  }
}

export function normalizeGitHubRawItem(input: unknown, options: GitHubNormalizationOptions = {}): NormalizedItem {
  const result = safeNormalizeGitHubRawItem(input, options);
  if (!result.success) throw new GitHubNormalizationError(result.issues);
  return result.data;
}

export function normalizeGitHubRawItems(
  inputs: readonly unknown[],
  options: { readonly firstSeenAtByRepositoryId?: ReadonlyMap<string, string> } = {},
): GitHubNormalizationBatchResult {
  const items: NormalizedItem[] = [];
  const errors: { index: number; issues: readonly GitHubNormalizationIssue[] }[] = [];
  for (const [index, input] of inputs.entries()) {
    const raw = RawItemSchema.safeParse(input);
    const firstSeenAt = raw.success && raw.data.externalId !== null
      ? options.firstSeenAtByRepositoryId?.get(raw.data.externalId)
      : undefined;
    const result = safeNormalizeGitHubRawItem(input, { firstSeenAt });
    if (result.success) items.push(result.data);
    else errors.push({ index, issues: result.issues });
  }
  return { items, errors };
}

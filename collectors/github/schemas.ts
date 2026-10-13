import { z } from "zod";
import { WebUrlSchema } from "../../types/primitives";

const GitHubTimestampSchema = z.iso.datetime({ offset: true }).refine(
  (value) => Number.isFinite(Date.parse(value)),
  { message: "Expected a valid GitHub timestamp" },
);

// 只验证实际使用的字段；GitHub 新增无关响应字段不影响采集。
export const GitHubRepositorySchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  name: z.string().min(1),
  full_name: z.string().min(1),
  html_url: WebUrlSchema,
  description: z.string().nullable(),
  owner: z.object({ login: z.string().min(1) }),
  stargazers_count: z.number().int().nonnegative(),
  forks_count: z.number().int().nonnegative(),
  open_issues_count: z.number().int().nonnegative(),
  language: z.string().nullable(),
  topics: z.array(z.string()),
  created_at: GitHubTimestampSchema,
  updated_at: GitHubTimestampSchema,
  pushed_at: GitHubTimestampSchema.nullable(),
  archived: z.boolean(),
  fork: z.boolean(),
  private: z.boolean(),
  default_branch: z.string().min(1),
});

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

// 顶层 items 保持 unknown[]，以便一个坏 Repo 不使整页作废。
export const GitHubSearchResponseSchema = z.object({
  total_count: z.number().int().nonnegative(),
  incomplete_results: z.boolean(),
  items: z.array(z.unknown()),
});

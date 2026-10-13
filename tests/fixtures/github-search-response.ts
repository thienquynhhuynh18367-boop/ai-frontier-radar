// 固定虚构 GitHub 风格响应；仅供离线测试，不包含实时抓取数据。
export const githubRepository = {
  id: 123,
  name: "radar-example",
  full_name: "sample/radar-example",
  html_url: "https://github.com/sample/radar-example",
  description: "A sample AI repository",
  owner: { login: "sample", id: 99 },
  stargazers_count: 42,
  forks_count: 7,
  open_issues_count: 3,
  language: "TypeScript",
  topics: ["mcp", "agent"],
  created_at: "2026-01-02T03:04:05Z",
  updated_at: "2026-10-12T13:00:00Z",
  pushed_at: "2026-10-12T13:00:00Z",
  archived: false,
  fork: false,
  private: false,
  default_branch: "main",
  events_url: "https://api.github.com/repos/sample/radar-example/events{/privacy}",
};

export const invalidGitHubRepository = { ...githubRepository, id: "not-an-id" };

export function githubResponse(items: readonly unknown[], incompleteResults = false, totalCount = items.length): string {
  return JSON.stringify({
    total_count: totalCount,
    incomplete_results: incompleteResults,
    items,
    unused_response_field: "ignored",
  });
}

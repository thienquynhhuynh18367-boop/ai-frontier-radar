export type GitHubSearchQuery = {
  readonly id: string;
  readonly query: string;
};

export const githubSearchQueries = [
  { id: "ai-agent", query: "topic:ai-agent" },
  { id: "agent", query: "topic:agent" },
  { id: "rag", query: "topic:rag" },
  { id: "mcp", query: "topic:mcp" },
  { id: "ai-coding", query: "topic:ai-coding" },
  { id: "llm", query: "topic:llm" },
  { id: "large-language-model", query: "topic:large-language-model" },
  { id: "enterprise-ai", query: "topic:enterprise-ai" },
] as const satisfies readonly GitHubSearchQuery[];

// Search 是前沿信号采样；当前每个 Query 只取第一页，避免高频消耗免费额度。
export const githubSearchRequestConfig = {
  perPage: 50,
  maxPagesPerQuery: 1,
  sort: "updated",
  order: "desc",
} as const;

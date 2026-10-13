import type { RawItem } from "../../types/raw-item";
import { githubRepository } from "./github-search-response";

// 与 T04 Collector 的最小输出同形，全部为虚构离线数据。
export const validGitHubRawItem: RawItem = {
  source: "github",
  sourceType: "api",
  externalId: String(githubRepository.id),
  url: githubRepository.html_url,
  collectedAt: "2026-10-13T09:00:00.000Z",
  data: {
    id: githubRepository.id,
    name: githubRepository.name,
    full_name: githubRepository.full_name,
    html_url: githubRepository.html_url,
    description: githubRepository.description,
    owner: { login: githubRepository.owner.login },
    stargazers_count: githubRepository.stargazers_count,
    forks_count: githubRepository.forks_count,
    open_issues_count: githubRepository.open_issues_count,
    language: githubRepository.language,
    topics: githubRepository.topics,
    created_at: githubRepository.created_at,
    updated_at: githubRepository.updated_at,
    pushed_at: githubRepository.pushed_at,
    archived: githubRepository.archived,
    fork: githubRepository.fork,
    private: githubRepository.private,
    default_branch: githubRepository.default_branch,
    matched_query_ids: ["mcp", "agent"],
  },
};

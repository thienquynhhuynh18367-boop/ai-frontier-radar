import { topicRules, officialGitHubOwners } from "../../config/classification";
import { profile } from "../../config/profile";
import type { NormalizedItem } from "../../types/normalized-item";

export type ClassifiedItem = NormalizedItem & { topics: string[]; companies: string[] };

export function classifyItem(item: NormalizedItem): ClassifiedItem {
  const description = item.metadata.description;
  const githubTopics = item.metadata.githubTopics;
  // 搜索命中 matchedQueryIds 不能证明业务分类，故不纳入匹配文本。
  const evidence = [item.title, typeof description === "string" ? description : "",
    ...(Array.isArray(githubTopics) ? githubTopics.filter((value): value is string => typeof value === "string") : [])]
    .join(" ");
  const topics = profile.topics
    .filter(({ id }) => topicRules[id].some((pattern) => pattern.test(evidence)))
    .map(({ id }) => id);
  const owner = item.metadata.owner;
  const company = typeof owner === "string"
    ? officialGitHubOwners[owner.toLowerCase() as keyof typeof officialGitHubOwners]
    : undefined;
  const companies = company && profile.companies.some(({ id }) => id === company) ? [company] : [];
  return { ...item, topics, companies };
}

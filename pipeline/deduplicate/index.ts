import { NormalizedItemSchema, type NormalizedItem } from "../../types/normalized-item";

export type DeduplicationResult = {
  items: NormalizedItem[];
  inputCount: number;
  outputCount: number;
  duplicateCount: number;
  rejected: { index: number; reason: string }[];
};

function stableKey(item: NormalizedItem): string {
  return JSON.stringify(item);
}

export function deduplicateItems(inputs: readonly unknown[]): DeduplicationResult {
  const groups = new Map<string, NormalizedItem[]>();
  const rejected: DeduplicationResult["rejected"] = [];
  for (const [index, input] of inputs.entries()) {
    const parsed = NormalizedItemSchema.safeParse(input);
    if (!parsed.success) {
      rejected.push({ index, reason: "invalid_normalized_item" });
      continue;
    }
    // 仓库/论文按来源稳定 ID，网页文章按规范 URL 指纹；标题相似绝不合并。
    const group = groups.get(parsed.data.id) ?? [];
    group.push(parsed.data);
    groups.set(parsed.data.id, group);
  }
  const items = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, group]) => {
    const ordered = [...group].sort((a, b) =>
      Number(["openai", "anthropic"].includes(b.source)) - Number(["openai", "anthropic"].includes(a.source)) ||
      b.collectedAt.localeCompare(a.collectedAt) || stableKey(a).localeCompare(stableKey(b)));
    const latest = ordered[0];
    const refs = [...new Map(ordered.flatMap((item) => item.sourceRefs)
      .map((ref) => [JSON.stringify(ref), ref] as const)).values()]
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const matchedQueryIds = [...new Set(ordered.flatMap((item) => {
      const value = item.metadata.matchedQueryIds;
      return Array.isArray(value) ? value.filter((part): part is string => typeof part === "string") : [];
    }))].sort();
    const hn = ordered.find((item) => item.source === "hacker-news");
    return NormalizedItemSchema.parse({
      ...latest,
      firstSeenAt: ordered.map((item) => item.firstSeenAt).sort()[0],
      sourceRefs: refs,
      metadata: { ...latest.metadata, matchedQueryIds,
        ...(hn && latest.source !== "hacker-news" ? {
          points: hn.metadata.points ?? null, comments: hn.metadata.comments ?? null,
          discussionUrl: hn.metadata.discussionUrl ?? null,
        } : {}) },
    });
  });
  return {
    items,
    inputCount: inputs.length,
    outputCount: items.length,
    duplicateCount: inputs.length - rejected.length - items.length,
    rejected,
  };
}

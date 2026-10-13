export type TopicPriority = "high" | "medium" | "low";

type Topic = { readonly id: string; readonly label: string; readonly priority: TopicPriority };
type Company = { readonly id: string; readonly label: string };

type Profile = {
  readonly version: string;
  readonly topics: readonly Topic[];
  readonly companies: readonly Company[];
};

// ID 用 lowercase-kebab-case 且保持稳定；显示文字可以调整而不影响历史统计键。
// 变更关注方向、优先级或 Ranking 权重时更新 version，使旧分数仍能追溯原配置。
export const profile = {
  version: "2026-10-13",
  topics: [
    { id: "agent", label: "Agent", priority: "high" },
    { id: "rag", label: "RAG", priority: "high" },
    { id: "mcp", label: "MCP", priority: "high" },
    { id: "ai-coding", label: "AI Coding", priority: "high" },
    { id: "enterprise-ai", label: "Enterprise AI", priority: "high" },
    { id: "ai-product", label: "AI Product", priority: "high" },
    { id: "ai-startup", label: "AI Startup", priority: "high" },
    { id: "funding", label: "Funding", priority: "high" },
    { id: "fde", label: "FDE", priority: "high" },
    { id: "multimodal", label: "Multimodal", priority: "medium" },
    { id: "ai-search", label: "AI Search", priority: "medium" },
    { id: "ai-infra", label: "AI Infra", priority: "medium" },
    { id: "research", label: "Research", priority: "medium" },
    { id: "model-training", label: "Model Training", priority: "low" },
    { id: "benchmark", label: "Benchmark", priority: "low" },
  ],
  companies: [
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "google", label: "Google" },
    { id: "deepseek", label: "DeepSeek" },
    { id: "byte-dance", label: "ByteDance" },
    { id: "alibaba", label: "Alibaba" },
  ],
} as const satisfies Profile;

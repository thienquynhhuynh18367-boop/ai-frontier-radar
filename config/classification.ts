export const topicRules = {
  agent: [/\bagents?\b/i, /\bautonomous agents?\b/i],
  rag: [/\brag\b/i, /\bretrieval[\s-]+augmented generation\b/i],
  mcp: [/\bmcp\b/i, /\bmodel context protocol\b/i],
  "ai-coding": [/\bai[\s-]+cod(?:e|ing)\b/i, /\bcoding agents?\b/i, /\bcode assistants?\b/i],
  "enterprise-ai": [/\benterprise[\s-]+ai\b/i, /\benterprise[\s-]+llm\b/i],
  "ai-product": [/\bai[\s-]+products?\b/i, /\bai[\s-]+applications?\b/i],
  "ai-startup": [/\bai[\s-]+startups?\b/i],
  funding: [/\b(?:funding|fundraise|series [a-f])\b/i],
  fde: [/\bfde\b/i, /\bforward[\s-]+deployed engineers?\b/i],
  multimodal: [/\bmultimodal\b/i, /\bmulti[\s-]+modal\b/i],
  "ai-search": [/\bai[\s-]+search\b/i, /\bsemantic[\s-]+search\b/i],
  "ai-infra": [/\bai[\s-]+infra(?:structure)?\b/i, /\bllm[\s-]+infra(?:structure)?\b/i],
  research: [/\bai[\s-]+research\b/i],
  "model-training": [/\bmodel[\s-]+training\b/i, /\bpretraining\b/i],
  benchmark: [/\bbenchmarks?\b/i],
} as const;

// 仅官方 Owner 可作为公司归属证据；仓库描述中的公司名称不够可靠。
export const officialGitHubOwners = {
  openai: "openai",
  anthropics: "anthropic",
  google: "google",
  "deepseek-ai": "deepseek",
  bytedance: "byte-dance",
  alibaba: "alibaba",
} as const;

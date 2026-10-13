import { profile } from "../../config/profile";
import type { IntelligenceItem } from "../../types/intelligence-item";

// 纯虚构的测试数据，不进入生产 data/。
export const validIntelligenceItem: IntelligenceItem = {
  schemaVersion: 1,
  id: "repository:example-agent-framework",
  title: "Example Agent Framework",
  url: "https://example.com/agent-framework",
  canonicalUrl: "https://example.com/agent-framework",
  source: "example-source",
  sourceType: "api",
  sourceRefs: [
    { source: "example-source", externalId: "agent-framework", url: "https://example.com/agent-framework" },
    { source: "example-community", externalId: null, url: "https://example.org/discussion/42" },
  ],
  contentType: "repository",
  publishedAt: "2026-10-12T09:00:00.000Z",
  firstSeenAt: "2026-10-13T08:00:00.000Z",
  collectedAt: "2026-10-13T08:30:00.000Z",
  topics: ["agent", "mcp"],
  companies: [],
  popularityScore: 80,
  personalScore: 91,
  scoreBreakdown: {
    topic: 35,
    source: 20,
    freshness: 18,
    popularity: 12,
    novelty: 6,
    profileVersion: profile.version,
    asOf: "2026-10-13T08:30:00.000Z",
  },
  metadata: {
    stars: 120,
    details: { language: "TypeScript", archived: false, release: null },
    tags: ["agent", "mcp"],
  },
};

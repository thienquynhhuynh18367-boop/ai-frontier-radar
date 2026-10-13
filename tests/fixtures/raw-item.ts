import type { RawItem } from "../../types/raw-item";

// 固定虚构样本，仅供离线契约测试使用。
export const validRawItem: RawItem = {
  source: "example-source",
  sourceType: "api",
  externalId: "item-1",
  url: "https://example.com/items/1",
  collectedAt: "2026-10-13T08:30:00.000Z",
  data: { title: "Example item", tags: ["agent"], count: 1, optional: null },
};

import { describe, expect, it } from "vitest";
import { parseIntelligenceItem, safeParseIntelligenceItem } from "../pipeline/validation";
import { validIntelligenceItem } from "./fixtures/intelligence-item";

describe("IntelligenceItem runtime contract", () => {
  it("accepts a valid item and keeps multiple source references", () => {
    const item = parseIntelligenceItem(validIntelligenceItem);
    expect(item.sourceRefs).toHaveLength(2);
    expect(safeParseIntelligenceItem(item).success).toBe(true);
  });

  it("rejects a missing id", () => {
    const withoutId = Object.fromEntries(
      Object.entries(validIntelligenceItem).filter(([key]) => key !== "id"),
    );
    const result = safeParseIntelligenceItem(withoutId);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((issue) => issue.field === "id")).toBe(true);
    }
  });

  it("rejects an unknown content type", () => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, contentType: "video" }).success).toBe(false);
  });

  it("rejects an unsupported schema version or missing source evidence", () => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, schemaVersion: 2 }).success).toBe(false);
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, sourceRefs: [] }).success).toBe(false);
  });

  it.each([
    { personalScore: 120 },
    { personalScore: -1 },
    { popularityScore: 120 },
    { popularityScore: -1 },
  ])("rejects a score outside 0–100: %j", (change) => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, ...change }).success).toBe(false);
  });

  it.each([
    "2026-02-30T08:30:00.000Z",
    "2026-10-13T08:30:00+08:00",
    "not-a-time",
  ])("rejects an invalid UTC timestamp: %s", (collectedAt) => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, collectedAt }).success).toBe(false);
  });

  it("accepts unknown publication time as null", () => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, publishedAt: null }).success).toBe(true);
  });

  it("accepts nested JSON metadata", () => {
    expect(safeParseIntelligenceItem(validIntelligenceItem).success).toBe(true);
  });

  it.each([
    new Date(),
    new Map([["key", "value"]]),
    new Set(["value"]),
    { value: undefined },
    { value: () => 1 },
    { value: Number.NaN },
    { value: Number.POSITIVE_INFINITY },
    { value: new (class ExampleClass { name = "example"; })() },
  ])("rejects metadata that cannot be safely stored as JSON", (value) => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, metadata: { value } }).success).toBe(false);
  });

  it("rejects circular metadata", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, metadata: { cycle } }).success).toBe(false);
  });

  it("requires HTTP or HTTPS URLs without making network requests", () => {
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, url: "ftp://example.com/item" }).success).toBe(false);
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, url: "https://example.com/item" }).success).toBe(true);
  });

  it("rejects a score breakdown that disagrees with the final score", () => {
    const scoreBreakdown = { ...validIntelligenceItem.scoreBreakdown, novelty: 5 };
    expect(safeParseIntelligenceItem({ ...validIntelligenceItem, scoreBreakdown }).success).toBe(false);
  });
});

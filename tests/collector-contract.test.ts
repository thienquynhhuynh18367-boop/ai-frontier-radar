import { describe, expect, it } from "vitest";
import {
  CollectorContextSchema,
  CollectorIdSchema,
  CollectorResultSchema,
  type Collector,
} from "../types/collector";
import { validRawItem } from "./fixtures/raw-item";

const http = {
  get: async () => ({ status: 200, ok: true, headers: {}, body: "" }),
};

const context = {
  asOf: "2026-10-13T09:00:00.000Z",
  windowStart: "2026-10-12T00:00:00.000Z",
  windowEnd: "2026-10-13T00:00:00.000Z",
  cursor: null,
  http,
};

const emptySuccess = {
  collectorId: "example-source",
  status: "success",
  items: [],
  receivedCount: 0,
  acceptedCount: 0,
  nextCursor: null,
  startedAt: "2026-10-13T08:30:00.000Z",
  finishedAt: "2026-10-13T08:31:00.000Z",
  errors: [],
};

const sourceError = { code: "page_failed", message: "Page could not be read", retryable: true };

describe("Collector contract", () => {
  it("accepts fixed UTC context and a test-only fake Collector", async () => {
    const collector: Collector = {
      id: "example-source",
      source: "example-source",
      collect: async () => CollectorResultSchema.parse(emptySuccess),
    };
    expect(CollectorContextSchema.safeParse(context).success).toBe(true);
    expect((await collector.collect(context)).status).toBe("success");
  });

  it("rejects invalid context time and a reversed window", () => {
    expect(CollectorContextSchema.safeParse({ ...context, asOf: "2026/10/13 18:30" }).success).toBe(false);
    expect(CollectorContextSchema.safeParse({ ...context, windowEnd: "2026-10-11T00:00:00.000Z" }).success).toBe(false);
    expect(CollectorContextSchema.safeParse({ ...context, cursor: new Date() }).success).toBe(false);
  });

  it("accepts success with no items and no errors", () => {
    expect(CollectorResultSchema.safeParse(emptySuccess).success).toBe(true);
  });

  it("accepts partial results with an error and distinct received/accepted counts", () => {
    const result = {
      ...emptySuccess,
      status: "partial",
      items: [validRawItem],
      receivedCount: 2,
      acceptedCount: 1,
      errors: [sourceError],
    };
    expect(CollectorResultSchema.safeParse(result).success).toBe(true);
  });

  it("accepts a failed source without accepted items", () => {
    expect(CollectorResultSchema.safeParse({
      ...emptySuccess,
      status: "failed",
      errors: [sourceError],
    }).success).toBe(true);
  });

  it("rejects inconsistent counts and misleading status", () => {
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, acceptedCount: 1 }).success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, receivedCount: 0, acceptedCount: 1, items: [validRawItem] }).success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, status: "failed" }).success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, errors: [sourceError] }).success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, status: "partial" }).success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, status: "failed", errors: [sourceError], nextCursor: "page-2" }).success).toBe(false);
  });

  it("requires lowercase-kebab-case Collector IDs", () => {
    expect(CollectorIdSchema.safeParse("example-source").success).toBe(true);
    expect(CollectorIdSchema.safeParse("Example_Source").success).toBe(false);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, collectorId: "Bad_ID" }).success).toBe(false);
  });

  it("accepts null or JSON-safe suggested cursors", () => {
    expect(CollectorResultSchema.safeParse(emptySuccess).success).toBe(true);
    expect(CollectorResultSchema.safeParse({
      ...emptySuccess,
      nextCursor: { page: 2, seen: ["item-1"] },
    }).success).toBe(true);
    expect(CollectorResultSchema.safeParse({ ...emptySuccess, nextCursor: new Date() }).success).toBe(false);
  });

  it("keeps Collector errors and results safe to serialize", () => {
    const result = CollectorResultSchema.parse({ ...emptySuccess, status: "failed", errors: [sourceError] });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(JSON.stringify(result)).not.toContain("stack");
  });
});

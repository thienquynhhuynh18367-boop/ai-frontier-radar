import { describe, expect, it } from "vitest";
import { RawItemSchema } from "../types/raw-item";
import { validRawItem } from "./fixtures/raw-item";

describe("RawItem runtime contract", () => {
  it("accepts a minimal source fact with nested JSON data", () => {
    expect(RawItemSchema.parse(validRawItem)).toEqual(validRawItem);
  });

  it.each(["ftp://example.com/item", "not-a-url"])(
    "rejects an invalid URL: %s",
    (url) => expect(RawItemSchema.safeParse({ ...validRawItem, url }).success).toBe(false),
  );

  it.each([
    { value: new Date() },
    { value: new Map([["key", "value"]]) },
    { value: undefined },
    { value: () => "secret" },
  ])("rejects non-JSON-safe data", (data) => {
    expect(RawItemSchema.safeParse({ ...validRawItem, data }).success).toBe(false);
  });

  it("rejects a nonexistent or non-UTC collection time", () => {
    for (const collectedAt of ["2026-02-30T08:30:00.000Z", "2026/10/13 18:30"]) {
      expect(RawItemSchema.safeParse({ ...validRawItem, collectedAt }).success).toBe(false);
    }
  });
});

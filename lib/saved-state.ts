import { z } from "zod";
import type { IntelligenceItem } from "../types/intelligence-item";
import { ContentTypeSchema } from "../types/base-item";
import { UtcTimestampSchema, WebUrlSchema } from "../types/primitives";

export const SAVED_STORAGE_KEY = "ai-frontier-radar.saved.v1";

const SnapshotSchema = z.strictObject({
  title: z.string().min(1), url: WebUrlSchema,
  source: z.string().min(1), contentType: ContentTypeSchema,
});

const SavedEntrySchema = z.strictObject({
  saved: z.boolean(), read: z.boolean(), hidden: z.boolean(),
  updatedAt: UtcTimestampSchema, snapshot: SnapshotSchema,
});

export const SavedStateSchema = z.strictObject({
  version: z.literal(1), entries: z.record(z.string().min(1), SavedEntrySchema),
});

export type SavedEntry = z.infer<typeof SavedEntrySchema>;
export type SavedState = z.infer<typeof SavedStateSchema>;
export const emptySavedState = (): SavedState => ({ version: 1, entries: {} });

export function snapshotOf(item: IntelligenceItem): SavedEntry["snapshot"] {
  return { title: item.title, url: item.url, source: item.source, contentType: item.contentType };
}

export function parseSavedState(input: string): SavedState {
  if (input.length > 1_000_000) throw new Error("收藏文件超过 1 MB 上限");
  const parsed = SavedStateSchema.parse(JSON.parse(input) as unknown);
  if (Object.keys(parsed.entries).length > 10_000) throw new Error("收藏条目超过 10,000 条上限");
  return parsed;
}

export function mergeSavedState(current: SavedState, imported: SavedState): SavedState {
  return SavedStateSchema.parse({ version: 1, entries: { ...current.entries, ...imported.entries } });
}

export function updateSavedEntry(
  state: SavedState, item: IntelligenceItem, field: "saved" | "read" | "hidden", now: string,
): SavedState {
  UtcTimestampSchema.parse(now);
  const prior = state.entries[item.id];
  const entry: SavedEntry = prior
    ? { ...prior, [field]: !prior[field], updatedAt: now, snapshot: snapshotOf(item) }
    : { saved: field === "saved", read: field === "read", hidden: field === "hidden",
      updatedAt: now, snapshot: snapshotOf(item) };
  return { version: 1, entries: { ...state.entries, [item.id]: entry } };
}

export function updateExistingEntry(state: SavedState, id: string,
  field: "saved" | "read" | "hidden", now: string): SavedState {
  UtcTimestampSchema.parse(now);
  const prior = state.entries[id];
  if (!prior) return state;
  return { version: 1, entries: { ...state.entries,
    [id]: { ...prior, [field]: !prior[field], updatedAt: now } } };
}

export function exportSavedState(state: SavedState): string {
  return JSON.stringify(SavedStateSchema.parse(state), null, 2) + "\n";
}

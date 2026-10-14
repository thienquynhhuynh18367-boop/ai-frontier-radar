import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { RawItemSchema } from "../types/raw-item";
import { LatestSchema, ManifestSchema, LegacySourceStatusSchema, MultiSourceLatestSchema, MultiSourceStatusSchema,
  type Latest, type SourceRun } from "../types/publication";
import { CollectorResultSchema, type CollectorResult } from "../types/collector";

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readLatest(root: string): Promise<Latest | null> {
  const json = await readJson(join(root, "data", "latest.json"));
  return json === null ? null : LatestSchema.parse(json);
}

export async function readFirstSeenHistory(root: string, asOf: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  let entries: string[];
  try {
    entries = await readdir(join(root, "data"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return found;
    throw error;
  }
  for (const day of entries.filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry)).sort()) {
    const json = await readJson(join(root, "data", day, "items.json"));
    if (json === null) continue;
    const snapshot = LatestSchema.parse(json);
    for (const item of snapshot.items) {
      if (item.firstSeenAt > asOf) continue;
      const numericId = item.id.match(/^github-repo:(\d+)$/)?.[1];
      if (!numericId) continue;
      const old = found.get(numericId);
      if (!old || item.firstSeenAt < old) found.set(numericId, item.firstSeenAt);
    }
  }
  return found;
}

export async function readFirstSeenByItemId(root: string, asOf: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const dataRoot = join(root, "data");
  const entries = await readdir(dataRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const day of entries.filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry)).sort()) {
    const json = await readJson(join(dataRoot, day, "items.json"));
    if (json === null) continue;
    for (const item of LatestSchema.parse(json).items) {
      if (item.firstSeenAt > asOf) continue;
      const old = found.get(item.id);
      if (!old || item.firstSeenAt < old) found.set(item.id, item.firstSeenAt);
    }
  }
  return found;
}

async function atomicBatchWrite(root: string, files: ReadonlyMap<string, unknown>): Promise<void> {
  const staging = join(root, "data", ".staging-" + randomUUID());
  const completed: { target: string; backup: string | null }[] = [];
  await mkdir(staging, { recursive: true });
  try {
    // 所有 JSON 先写入暂存目录并完成语法往返检查，再改动任一正式路径。
    for (const [relative, value] of files) {
      const staged = join(staging, "new", relative);
      await mkdir(dirname(staged), { recursive: true });
      const content = JSON.stringify(value, null, 2) + "\n";
      JSON.parse(content);
      await writeFile(staged, content, "utf8");
    }
    for (const relative of files.keys()) {
      const target = join(root, relative);
      const staged = join(staging, "new", relative);
      const backup = join(staging, "backup", relative);
      await mkdir(dirname(target), { recursive: true });
      let backedUp = false;
      try {
        await mkdir(dirname(backup), { recursive: true });
        await rename(target, backup);
        backedUp = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      completed.push({ target, backup: backedUp ? backup : null });
      await rename(staged, target);
    }
  } catch (error) {
    for (const entry of completed.reverse()) {
      await rm(entry.target, { force: true });
      if (entry.backup) await rename(entry.backup, entry.target);
    }
    throw error;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

function statusFor(latest: Latest | null, status: Exclude<SourceRun["status"], "carried">, asOf: string,
  result: CollectorResult, errors: string[], publishedCount?: number) {
  return LegacySourceStatusSchema.parse({
    schemaVersion: 1, source: "github-search", status, lastAttemptAt: asOf,
    lastSuccessAt: status === "success" ? asOf : latest?.asOf ?? null,
    receivedCount: result.receivedCount, acceptedCount: result.acceptedCount,
    itemCount: status === "success" ? publishedCount ?? 0 : latest?.itemCount ?? 0,
    errorCodes: [...new Set(errors)].sort(),
  });
}

export async function publishCollection(root: string, latest: Latest, result: CollectorResult): Promise<void> {
  const checked = LatestSchema.parse(latest);
  const previous = await readLatest(root);
  if (previous && checked.date < previous.date) throw new Error("Cannot replace latest with an older day");
  const rawItems = result.items.map((item) => {
    const rawItem = RawItemSchema.parse(item);
    const url = new URL(rawItem.url);
    // 公开 Raw 快照只接收无 query 的官方仓库根链接，避免意外保存 URL 中的凭据。
    if (rawItem.source !== "github" || url.protocol !== "https:" || url.hostname !== "github.com" ||
      url.search || url.hash || url.username || url.password ||
      !/^\/[^/]+\/[^/]+$/.test(url.pathname)) {
      throw new Error("Unsafe GitHub RawItem URL");
    }
    return rawItem;
  });
  const raw = { schemaVersion: 1, date: checked.date, source: "github-search", items: rawItems };
  const dataRoot = join(root, "data");
  const dates = (await readdir(dataRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));
  const manifest = ManifestSchema.parse({
    schemaVersion: 1, latestDate: checked.date, latestAsOf: checked.asOf,
    itemCount: checked.itemCount, dates: [...new Set([...dates, checked.date])].sort(),
  });
  const status = statusFor(previous, "success", checked.asOf, result, [], checked.itemCount);
  const files = new Map<string, unknown>([
    [join("data", "raw", checked.date, "github-search.json"), raw],
    [join("data", checked.date, "items.json"), checked],
    [join("data", "manifest.json"), manifest],
    [join("data", "sources-status.json"), status],
    [join("public", "data", "manifest.json"), manifest],
    [join("public", "data", "sources-status.json"), status],
    // 指针文件最后替换；常规写入错误会回滚所有已替换的目标。
    [join("data", "latest.json"), checked],
    [join("public", "data", "latest.json"), checked],
  ]);
  // 发布目录只含已验证的结果、清单和状态；RawItem 永不进入 public/data。
  await atomicBatchWrite(root, files);
}

export async function recordFailure(root: string, previous: Latest | null, status: Exclude<SourceRun["status"], "carried">,
  asOf: string, result: CollectorResult, errors: string[]): Promise<void> {
  const health = statusFor(previous, status, asOf, result, errors);
  await atomicBatchWrite(root, new Map([
    [join("data", "sources-status.json"), health],
    [join("public", "data", "sources-status.json"), health],
  ]));
}

function validatePublicRaw(result: CollectorResult): void {
  for (const value of result.items) {
    const item = RawItemSchema.parse(value);
    const url = new URL(item.url);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      (item.source !== "hacker-news" && url.search) ||
      (item.source === "hacker-news" && (url.hostname !== "news.ycombinator.com" || !/^\?id=\d+$/.test(url.search)))) {
      throw new Error("Unsafe public RawItem URL");
    }
    const hosts: Record<string, string> = { github: "github.com", arxiv: "arxiv.org", openai: "openai.com",
      anthropic: "www.anthropic.com", "anthropic-jobs": "job-boards.greenhouse.io" };
    if (item.source !== "hacker-news" && url.hostname !== hosts[item.source]) throw new Error("Unsafe public RawItem URL");
    const content = JSON.stringify(item.data);
    if (content.length > 12_000 || /"(?:authorization|cookie|token|password|html|story_text)"\s*:/i.test(content)) {
      throw new Error("Unsafe RawItem data fields");
    }
    if (item.source === "hacker-news" && typeof item.data.originalUrl === "string") {
      const original = new URL(item.data.originalUrl);
      if (!["https:", "http:"].includes(original.protocol) || original.username || original.password || original.search || original.hash) {
        throw new Error("Unsafe RawItem data fields");
      }
    }
  }
}

export async function publishMultiSource(root: string, latest: unknown, results: ReadonlyMap<string, CollectorResult>): Promise<void> {
  const checked = MultiSourceLatestSchema.parse(latest);
  const previous = await readLatest(root);
  if (previous && checked.date < previous.date) throw new Error("Cannot replace latest with an older day");
  if (!checked.items.length || !checked.sources.some((source) => source.status === "success" || source.status === "partial")) {
    throw new Error("No fresh source to publish");
  }
  for (const source of checked.sources) {
    const result = results.get(source.source);
    if (!result || result.collectorId !== source.source || result.receivedCount !== source.receivedCount ||
      result.acceptedCount !== source.acceptedCount || !CollectorResultSchema.safeParse(result).success) {
      throw new Error("Source result does not match publication");
    }
    validatePublicRaw(result);
  }
  if (results.size !== checked.sources.length) throw new Error("Unexpected source result");
  const dataRoot = join(root, "data");
  const dates = (await readdir(dataRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })).filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry));
  const manifest = ManifestSchema.parse({ schemaVersion: 1, latestDate: checked.date, latestAsOf: checked.asOf,
    itemCount: checked.itemCount, dates: [...new Set([...dates, checked.date])].sort() });
  const status = MultiSourceStatusSchema.parse({ schemaVersion: 2, sources: checked.sources });
  const files = new Map<string, unknown>();
  for (const [id, result] of results) if (result.status !== "failed") files.set(
    join("data", "raw", checked.date, `${id}.json`),
    { schemaVersion: 1, date: checked.date, source: id, items: result.items },
  );
  files.set(join("data", checked.date, "items.json"), checked);
  files.set(join("data", "manifest.json"), manifest);
  files.set(join("data", "sources-status.json"), status);
  files.set(join("public", "data", "manifest.json"), manifest);
  files.set(join("public", "data", "sources-status.json"), status);
  files.set(join("data", "latest.json"), checked);
  files.set(join("public", "data", "latest.json"), checked);
  await atomicBatchWrite(root, files);
}

export async function recordMultiFailure(root: string, sources: readonly SourceRun[]): Promise<void> {
  const status = MultiSourceStatusSchema.parse({ schemaVersion: 2, sources });
  await atomicBatchWrite(root, new Map([
    [join("data", "sources-status.json"), status],
    [join("public", "data", "sources-status.json"), status],
  ]));
}

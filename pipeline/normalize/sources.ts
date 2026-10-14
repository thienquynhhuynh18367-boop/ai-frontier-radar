import { createHash } from "node:crypto";
import { z } from "zod";
import { NormalizedItemSchema, type NormalizedItem } from "../../types/normalized-item";
import { RawItemSchema } from "../../types/raw-item";

const HnData = z.object({ title: z.string().min(1), originalUrl: z.url().nullable(), discussionUrl: z.url(),
  publishedAt: z.iso.datetime({ offset: true }), points: z.number().int().nonnegative().nullable(),
  comments: z.number().int().nonnegative().nullable(), author: z.string().nullable(),
  matchedQueryIds: z.array(z.string()), showHn: z.boolean() });
const ArxivData = z.object({ title: z.string().min(1), summary: z.string().nullable(),
  authors: z.array(z.string()), categories: z.array(z.string()),
  submittedAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }).nullable() });
const OfficialData = z.object({ lastmod: z.iso.datetime({ offset: true }) });
const JobData = z.object({ title: z.string().min(1), location: z.string().nullable(), updatedAt: z.iso.datetime({ offset: true }) });

export function canonicalWebUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key)) url.searchParams.delete(key);
    if (!url.searchParams.size) url.search = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch { return null; }
}

function webId(url: string): string { return `web:${createHash("sha256").update(url).digest("hex").slice(0, 24)}`; }

export function normalizeSourceItem(input: unknown, firstSeenAt?: string): NormalizedItem {
  const raw = RawItemSchema.parse(input);
  const seen = firstSeenAt && firstSeenAt <= raw.collectedAt ? firstSeenAt : raw.collectedAt;
  if (raw.source === "hacker-news") {
    const data = HnData.parse(raw.data);
    const original = data.originalUrl ? canonicalWebUrl(data.originalUrl) : null;
    const discussion = `https://news.ycombinator.com/item?id=${raw.externalId}`;
    if (!/^\d+$/.test(raw.externalId ?? "") || raw.url !== discussion || data.discussionUrl !== discussion) throw new Error("Invalid HN identity");
    return NormalizedItemSchema.parse({ schemaVersion: 1, id: original ? webId(original) : `hn-story:${raw.externalId}`,
      title: data.title, url: original ?? discussion, canonicalUrl: original ?? discussion,
      source: raw.source, sourceType: raw.sourceType,
      sourceRefs: [{ source: raw.source, externalId: raw.externalId, url: discussion }],
      contentType: data.showHn ? "product" : "news", publishedAt: data.publishedAt,
      firstSeenAt: seen, collectedAt: raw.collectedAt,
      metadata: { description: null, author: data.author, points: data.points, comments: data.comments,
        discussionUrl: discussion, matchedQueryIds: [...new Set(data.matchedQueryIds)].sort() } });
  }
  if (raw.source === "arxiv") {
    const data = ArxivData.parse(raw.data);
    if (!/^\d{4}\.\d{4,5}$/.test(raw.externalId ?? "") || raw.url !== `https://arxiv.org/abs/${raw.externalId}`) throw new Error("Invalid arXiv identity");
    return NormalizedItemSchema.parse({ schemaVersion: 1, id: `arxiv-paper:${raw.externalId}`,
      title: data.title, url: raw.url, canonicalUrl: raw.url, source: raw.source, sourceType: raw.sourceType,
      sourceRefs: [{ source: raw.source, externalId: raw.externalId, url: raw.url }], contentType: "paper",
      publishedAt: data.submittedAt, firstSeenAt: seen, collectedAt: raw.collectedAt,
      metadata: { description: data.summary, authors: data.authors, categories: data.categories,
        submittedAt: data.submittedAt, updatedAt: data.updatedAt } });
  }
  if (raw.source === "openai" || raw.source === "anthropic") {
    const data = OfficialData.parse(raw.data);
    const canonicalUrl = canonicalWebUrl(raw.url);
    const host = raw.source === "openai" ? "openai.com" : "www.anthropic.com";
    if (!canonicalUrl || new URL(canonicalUrl).hostname !== host || raw.externalId !== raw.url) throw new Error("Invalid official URL");
    const path = new URL(canonicalUrl).pathname;
    const slug = path.split("/").filter(Boolean).at(-1) ?? raw.source;
    const type = /(?:product|release|introducing|launch)/i.test(path) ? "product" : "company_update";
    return NormalizedItemSchema.parse({ schemaVersion: 1, id: webId(canonicalUrl),
      // Sitemap 没有标题；只显示 URL slug，不声称它是原文标题。
      title: slug.replace(/[-_]+/g, " "), url: canonicalUrl, canonicalUrl,
      source: raw.source, sourceType: raw.sourceType,
      sourceRefs: [{ source: raw.source, externalId: raw.externalId, url: raw.url }],
      contentType: type, publishedAt: null, firstSeenAt: seen, collectedAt: raw.collectedAt,
      metadata: { description: null, lastmod: data.lastmod, titleEvidence: "url-slug" } });
  }
  if (raw.source === "anthropic-jobs") {
    const data = JobData.parse(raw.data);
    const id = raw.externalId;
    if (!/^\d+$/.test(id ?? "") || raw.url !== `https://job-boards.greenhouse.io/anthropic/jobs/${id}`) throw new Error("Invalid Anthropic job identity");
    return NormalizedItemSchema.parse({ schemaVersion: 1, id: `anthropic-job:${id}`, title: data.title,
      url: raw.url, canonicalUrl: raw.url, source: raw.source, sourceType: raw.sourceType,
      sourceRefs: [{ source: raw.source, externalId: id, url: raw.url }], contentType: "job",
      publishedAt: null, firstSeenAt: seen, collectedAt: raw.collectedAt,
      metadata: { description: null, location: data.location, updatedAt: data.updatedAt, company: "Anthropic" } });
  }
  throw new Error("Unsupported source");
}

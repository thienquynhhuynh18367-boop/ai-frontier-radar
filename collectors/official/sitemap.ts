import { CollectorContextSchema, CollectorResultSchema, type Collector, type CollectorContext, type CollectorError } from "../../types/collector";
import { RawItemSchema, type RawItem } from "../../types/raw-item";
import { parseSafeXml, records, textValue } from "../../lib/safe-xml";

type Site = "openai" | "anthropic";
const config = {
  openai: { root: "https://openai.com/sitemap.xml", host: "openai.com", sections: ["product", "release", "research", "startup", "company"] },
  anthropic: { root: "https://www.anthropic.com/sitemap.xml", host: "www.anthropic.com", sections: [] },
} as const;

function allowed(site: Site, urlText: string): boolean {
  try {
    const url = new URL(urlText);
    if (url.protocol !== "https:" || url.hostname !== config[site].host || url.username || url.password || url.search || url.hash) return false;
    return site === "openai" ? /^\/(?:index\/|research\/|business\/|news\/)/.test(url.pathname)
      : /^\/(?:news|research|engineering)\//.test(url.pathname);
  } catch { return false; }
}

export class OfficialSitemapCollector implements Collector {
  readonly id: Site;
  readonly source: Site;
  readonly queryStats: { id: string; received: number; accepted: number; rejected: number; requests: number }[] = [];
  constructor(site: Site, private readonly options: { now?: () => string; maxSections?: number } = {}) {
    this.id = site; this.source = site;
  }

  async collect(context: CollectorContext) {
    CollectorContextSchema.parse(context);
    const now = this.options.now ?? (() => new Date().toISOString());
    const startedAt = now();
    const errors: CollectorError[] = [];
    const items: RawItem[] = [];
    const sections = this.source === "openai" ? config.openai.sections.slice(0, this.options.maxSections ?? 5)
      .map((section) => `https://openai.com/sitemap.xml/${section}/`) : [config.anthropic.root];
    this.queryStats.length = 0;
    for (const sectionUrl of sections) {
      const id = this.source === "openai" ? sectionUrl.split("/").filter(Boolean).at(-1)! : "sitemap";
      const stat = { id, received: 0, accepted: 0, rejected: 0, requests: 1 };
      this.queryStats.push(stat);
      try {
        const response = await context.http.get(sectionUrl, { timeoutMs: 30_000 });
        const entries = records(parseSafeXml(response.body).urlset)[0];
        if (!entries) throw new Error("Invalid sitemap");
        for (const entry of records(entries.url)) {
          stat.received++;
          const url = textValue(entry.loc);
          const lastmod = textValue(entry.lastmod);
          // Sitemap lastmod 不是发布日期；仅作为“可能更新”的发现时间证据。
          if (!url || !allowed(this.source, url) || !lastmod || !Number.isFinite(Date.parse(lastmod)) ||
            Date.parse(lastmod) < Date.parse(context.windowStart) || Date.parse(lastmod) >= Date.parse(context.windowEnd)) {
            stat.rejected++; continue;
          }
          const cleanUrl = new URL(url).toString();
          items.push(RawItemSchema.parse({ source: this.source, sourceType: "sitemap", externalId: cleanUrl,
            url: cleanUrl, collectedAt: context.asOf, data: { lastmod: new Date(lastmod).toISOString() } }));
          stat.accepted++;
        }
      } catch {
        errors.push({ code: `${this.source}-sitemap-failed`, message: `${this.source} sitemap ${id} failed`, retryable: false });
      }
    }
    const status = errors.length === 0 ? "success" : errors.length === sections.length ? "failed" : "partial";
    const accepted = status === "failed" ? [] : [...new Map(items.map((item) => [item.url, item])).values()].sort((a, b) => a.url.localeCompare(b.url));
    return CollectorResultSchema.parse({ collectorId: this.id, status, items: accepted,
      receivedCount: this.queryStats.reduce((n, stat) => n + stat.received, 0), acceptedCount: accepted.length,
      nextCursor: null, startedAt, finishedAt: now(), errors });
  }
}

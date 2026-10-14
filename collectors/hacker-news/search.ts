import { z } from "zod";
import { hackerNewsPageSize, hackerNewsQueries } from "../../config/sources/hacker-news";
import { CollectorContextSchema, CollectorResultSchema, type Collector, type CollectorContext, type CollectorError } from "../../types/collector";
import { RawItemSchema, type RawItem } from "../../types/raw-item";

const HitSchema = z.object({ objectID: z.string().regex(/^\d+$/), title: z.string().min(1), url: z.string().nullish(),
  author: z.string().nullish(), points: z.number().int().nonnegative().nullish(),
  num_comments: z.number().int().nonnegative().nullish(), created_at: z.iso.datetime({ offset: true }),
  _tags: z.array(z.string()).optional() }).passthrough();
const ResponseSchema = z.object({ hits: z.array(z.unknown()), nbPages: z.number().int().nonnegative() });

export type HnQueryStat = { id: string; received: number; accepted: number; rejected: number; requests: number };
export class HackerNewsCollector implements Collector {
  readonly id = "hacker-news";
  readonly source = "hacker-news";
  readonly queryStats: HnQueryStat[] = [];
  constructor(private readonly options: { queries?: readonly string[]; perPage?: number; maxPages?: number; now?: () => string } = {}) {}

  async collect(context: CollectorContext) {
    CollectorContextSchema.parse(context);
    const startedAt = (this.options.now ?? (() => new Date().toISOString()))();
    const matches = new Map<string, { hit: z.infer<typeof HitSchema>; queries: Set<string> }>();
    const errors: CollectorError[] = [];
    let receivedCount = 0;
    this.queryStats.length = 0;
    for (const query of this.options.queries ?? hackerNewsQueries) {
      const stat = { id: query.toLowerCase().replace(/[^a-z0-9]+/g, "-"), received: 0, accepted: 0, rejected: 0, requests: 0 };
      this.queryStats.push(stat);
      for (let page = 0; page < (this.options.maxPages ?? 1); page++) {
        const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
        url.search = new URLSearchParams({ query, tags: "story", numericFilters:
          `created_at_i>=${Math.ceil(Date.parse(context.windowStart) / 1000)},created_at_i<${Math.ceil(Date.parse(context.windowEnd) / 1000)}`,
          page: String(page), hitsPerPage: String(this.options.perPage ?? hackerNewsPageSize) }).toString();
        stat.requests++;
        try {
          const response = await context.http.get(url.toString());
          const parsed = ResponseSchema.parse(JSON.parse(response.body) as unknown);
          receivedCount += parsed.hits.length;
          stat.received += parsed.hits.length;
          for (const value of parsed.hits) {
            const hit = HitSchema.safeParse(value);
            if (!hit.success || Date.parse(hit.data.created_at) < Date.parse(context.windowStart) ||
              Date.parse(hit.data.created_at) >= Date.parse(context.windowEnd)) { stat.rejected++; continue; }
            const existing = matches.get(hit.data.objectID);
            if (existing) existing.queries.add(stat.id);
            else matches.set(hit.data.objectID, { hit: hit.data, queries: new Set([stat.id]) });
            stat.accepted++;
          }
          if (page + 1 >= parsed.nbPages || parsed.hits.length < (this.options.perPage ?? hackerNewsPageSize)) break;
        } catch {
          errors.push({ code: "hacker-news-request-failed", message: `HN query ${stat.id} page ${page} failed`, retryable: false });
          break;
        }
      }
    }
    const items: RawItem[] = [];
    for (const [id, { hit, queries }] of [...matches].sort(([a], [b]) => a.localeCompare(b))) {
      const discussionUrl = `https://news.ycombinator.com/item?id=${id}`;
      let originalUrl: string | null = null;
      try { const url = new URL(hit.url ?? ""); if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) {
        // 未知 query 可能决定文章身份或包含凭据；仅移除已知追踪参数，其余链接不持久化。
        for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
        url.hash = "";
        if (!url.searchParams.size) { url.search = ""; originalUrl = url.toString(); }
      } } catch { /* Show HN 无外链。 */ }
      items.push(RawItemSchema.parse({ source: this.source, sourceType: "api", externalId: id,
        url: discussionUrl, collectedAt: context.asOf, data: { title: hit.title, originalUrl, discussionUrl,
          publishedAt: new Date(hit.created_at).toISOString(), points: hit.points ?? null,
          comments: hit.num_comments ?? null, author: hit.author ?? null, matchedQueryIds: [...queries].sort(),
          showHn: hit._tags?.includes("show_hn") ?? false } }));
    }
    const status = this.queryStats.every((stat) => stat.requests > 0) && !errors.length ? "success" : items.length ? "partial" : "failed";
    return CollectorResultSchema.parse({ collectorId: this.id, status, items: status === "failed" ? [] : items,
      receivedCount, acceptedCount: status === "failed" ? 0 : items.length, nextCursor: null,
      startedAt, finishedAt: (this.options.now ?? (() => new Date().toISOString()))(), errors });
  }
}

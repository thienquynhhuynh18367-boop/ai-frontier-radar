import { CollectorContextSchema, CollectorResultSchema, type Collector, type CollectorContext, type CollectorError } from "../../types/collector";
import { RawItemSchema, type RawItem } from "../../types/raw-item";
import { parseSafeXml, records, textValue } from "../../lib/safe-xml";

const TOPIC = /\b(agent(?:s|ic)?|retrieval|rag|tool[ -]?use|reasoning|multimodal|multi[ -]?modal|llm|language model|ai coding)\b/i;
const CATEGORIES = new Set(["cs.AI", "cs.CL", "cs.LG"]);

export class ArxivCollector implements Collector {
  readonly id = "arxiv";
  readonly source = "arxiv";
  readonly queryStats: { id: string; received: number; accepted: number; rejected: number; requests: number }[] = [];
  constructor(private readonly options: { maxResults?: number; now?: () => string } = {}) {}

  async collect(context: CollectorContext) {
    CollectorContextSchema.parse(context);
    const now = this.options.now ?? (() => new Date().toISOString());
    const startedAt = now();
    const stat = { id: "cs-ai-cl-lg", received: 0, accepted: 0, rejected: 0, requests: 1 };
    this.queryStats.length = 0; this.queryStats.push(stat);
    const errors: CollectorError[] = [];
    const items: RawItem[] = [];
    const url = new URL("https://export.arxiv.org/api/query");
    url.search = new URLSearchParams({ search_query: "cat:cs.AI OR cat:cs.CL OR cat:cs.LG", start: "0",
      max_results: String(this.options.maxResults ?? 100), sortBy: "submittedDate", sortOrder: "descending" }).toString();
    try {
      const response = await context.http.get(url.toString(), { timeoutMs: 30_000 });
      const feed = records(parseSafeXml(response.body).feed)[0];
      if (!feed) throw new Error("Invalid Atom feed");
      for (const entry of records(feed.entry)) {
        stat.received++;
        const urlText = textValue(entry.id);
        const id = urlText?.match(/arxiv\.org\/abs\/((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?)/i)?.[1]?.replace(/v\d+$/, "");
        const title = textValue(entry.title)?.replace(/\s+/g, " ");
        const summary = textValue(entry.summary)?.replace(/\s+/g, " ").slice(0, 1800);
        const submitted = textValue(entry.published);
        const updated = textValue(entry.updated);
        const categories = records(entry.category).map((cat) => cat["@_term"]).filter((part): part is string => typeof part === "string");
        if (!id || !title || !submitted || !Number.isFinite(Date.parse(submitted)) ||
          Date.parse(submitted) < Date.parse(context.windowStart) || Date.parse(submitted) >= Date.parse(context.windowEnd) ||
          !categories.some((category) => CATEGORIES.has(category)) || !TOPIC.test(`${title} ${summary ?? ""}`)) {
          stat.rejected++; continue;
        }
        const authors = records(entry.author).map((author) => textValue(author.name)).filter((part): part is string => Boolean(part)).slice(0, 30);
        items.push(RawItemSchema.parse({ source: this.source, sourceType: "api", externalId: id,
          url: `https://arxiv.org/abs/${id}`, collectedAt: context.asOf,
          data: { title, summary: summary ?? null, authors, categories: [...new Set(categories)].sort(),
            submittedAt: new Date(submitted).toISOString(), updatedAt: updated && Number.isFinite(Date.parse(updated)) ? new Date(updated).toISOString() : null } }));
        stat.accepted++;
      }
    } catch {
      errors.push({ code: "arxiv-request-failed", message: "arXiv Atom request or response failed", retryable: false });
    }
    return CollectorResultSchema.parse({ collectorId: this.id, status: errors.length ? "failed" : "success",
      items: errors.length ? [] : items, receivedCount: stat.received, acceptedCount: errors.length ? 0 : items.length,
      nextCursor: null, startedAt, finishedAt: now(), errors });
  }
}

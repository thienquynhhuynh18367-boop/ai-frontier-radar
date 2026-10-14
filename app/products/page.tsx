import { UnconnectedRadar } from "../../components/unconnected-radar";
import { PageHeader, DataBanner } from "../../components/page-frame";
import { ItemList } from "../../components/item-list";
import { EmptyState } from "../../components/radar-ui";
import { loadPreview } from "../../lib/preview-data";
export default async function ProductsPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  const items = preview.latest?.items.filter((item) => item.contentType === "product") ?? [];
  const connected = preview.latest?.schemaVersion === 2 && preview.latest.sources.some((source) => ["hacker-news", "openai", "anthropic"].includes(source.source));
  return connected ? <><PageHeader eyebrow="SOURCE RADAR / PRODUCTS" title="产品雷达" description="公开来源中有可追溯链接的产品发布与更新采样。" />
    <DataBanner preview={preview} />{items.length ? <ItemList items={items} /> : <EmptyState title="本次没有产品更新候选" description="来源已接入，但该业务日没有经过验证的产品相关条目。" />}</> : <UnconnectedRadar module="products" />;
}

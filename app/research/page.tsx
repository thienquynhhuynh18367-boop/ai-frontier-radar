import { UnconnectedRadar } from "../../components/unconnected-radar";
import { PageHeader, DataBanner, ScopeNote } from "../../components/page-frame";
import { ItemList } from "../../components/item-list";
import { EmptyState } from "../../components/radar-ui";
import { loadPreview } from "../../lib/preview-data";
export default async function ResearchPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  const items = preview.latest?.items.filter((item) => item.contentType === "paper") ?? [];
  const connected = preview.latest?.schemaVersion === 2 && preview.latest.sources.some((source) => source.source === "arxiv");
  return connected ? <><PageHeader eyebrow="SOURCE RADAR / RESEARCH" title="研究雷达" description="来自 arXiv 官方元数据的 AI 论文采样，不镜像 PDF。" />
    <DataBanner preview={preview} />{items.length ? <ItemList items={items} /> : <EmptyState title="本次没有匹配论文" description="arXiv 已接入，但该业务日的受控采样没有入选论文。" />}
    <div className="mt-5"><ScopeNote>Thank you to arXiv for use of its open access interoperability. 本站仅展示论文元数据，不代表 arXiv 认可本项目。</ScopeNote></div>
  </> : <UnconnectedRadar module="research" />;
}

import { UnconnectedRadar } from "../../components/unconnected-radar";
import { PageHeader, DataBanner, ScopeNote } from "../../components/page-frame";
import { ItemList } from "../../components/item-list";
import { EmptyState } from "../../components/radar-ui";
import { loadPreview } from "../../lib/preview-data";
export default async function CareerPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  const items = preview.latest?.items.filter((item) => item.contentType === "job") ?? [];
  const connected = preview.latest?.schemaVersion === 2 && preview.latest.sources.some((source) => source.source === "anthropic-jobs");
  return connected ? <><PageHeader eyebrow="SOURCE RADAR / CAREER" title="职业雷达" description="Anthropic 官网链接的公开招聘板中，AI PM、FDE 与 Applied AI 岗位的更新信号。" />
    <DataBanner preview={preview} />{items.length ? <ItemList items={items} /> : <EmptyState title="本次没有匹配的岗位更新" description="来源已接入，但该业务日没有符合主题和更新时间窗口的岗位；这不表示招聘板没有开放岗位。" />}
    <div className="mt-5"><ScopeNote>岗位 updated_at 只证明招聘板记录发生更新；无法从该字段断言岗位首次发布或仍开放多久。</ScopeNote></div>
  </> : <UnconnectedRadar module="career" />;
}

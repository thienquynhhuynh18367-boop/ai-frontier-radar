import { DataBanner, PageHeader, ScopeNote } from "../../components/page-frame";
import { HealthPanel } from "../../components/health-panel";
import { loadPreview } from "../../lib/preview-data";

export default async function HealthPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <>
    <PageHeader eyebrow="SYSTEM / SOURCE HEALTH" title="数据源状态"
      description="区分最近尝试与最近有效发布，及时发现采集失败、校验异常或数据过期。" />
    <DataBanner preview={preview} />
    <HealthPanel health={preview.health} manifest={preview.manifest}
      latestAsOf={preview.latest?.asOf ?? null} staleAtBuild={preview.stale} />
    <div className="mt-5"><ScopeNote>来源状态与历史清单来自公开发布 JSON。静态部署后，新增采集结果需要重新构建网站。</ScopeNote></div>
  </>;
}

import { ExploreClient } from "../../components/explore-client";
import { DataBanner, PageHeader, ScopeNote } from "../../components/page-frame";
import { loadPreview } from "../../lib/preview-data";

export default async function GitHubPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <>
    <PageHeader eyebrow="SOURCE RADAR / GITHUB" title="GitHub Radar"
      description="查看通过精确 Push 时间窗口过滤的公开仓库；Stars、Forks 与 GitHub Topics 来自采集时的仓库元数据。" />
    <DataBanner preview={preview} />
    <ExploreClient items={preview.latest?.items ?? []} asOf={preview.latest?.asOf ?? new Date().toISOString()} githubOnly />
    <div className="mt-5"><ScopeNote>GitHub Search 当前按配置查询并限制每组候选页数。Stars 为累计值，尚无可靠的 Star Growth 历史。</ScopeNote></div>
  </>;
}

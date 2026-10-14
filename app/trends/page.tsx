import { DataBanner, PageHeader, ScopeNote } from "../../components/page-frame";
import { TrendsPanel } from "../../components/trends-panel";
import { loadPreview } from "../../lib/preview-data";
import { computeTrendWindow, loadTrendSnapshots } from "../../lib/trend-data";
import { topicCounts } from "../../lib/web-data";

export default async function TrendsPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  const snapshots = preview.latest ? await loadTrendSnapshots(process.cwd(), preview.manifest?.dates ?? []) : [];
  const latestItems = preview.latest?.items ?? [];
  const sources = new Map<string, number>();
  for (const item of latestItems) sources.set(item.source, (sources.get(item.source) ?? 0) + 1);
  return <>
    <PageHeader eyebrow="OBSERVATIONS / TRENDS" title="趋势观察"
      description="只用连续的真实历史快照计算主题变化；数据不足时展示已观测事实。" />
    <DataBanner preview={preview} />
    <TrendsPanel windows={([7, 30, 90] as const).map((days) => computeTrendWindow(snapshots, days))}
      latestTopics={[...topicCounts(latestItems)].sort((a, b) => b[1] - a[1])}
      sourceCounts={[...sources].sort((a, b) => b[1] - a[1])} latestDate={preview.latest?.date ?? null} />
    <div className="mt-5"><ScopeNote>增长率要求等长连续窗口及一致来源覆盖；Stars 增量只用同一仓库至少两次真实观测计算，不推断未观测日期。</ScopeNote></div>
  </>;
}

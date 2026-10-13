import { ExploreClient } from "../../components/explore-client";
import { DataBanner, PageHeader, ScopeNote } from "../../components/page-frame";
import { loadPreview } from "../../lib/preview-data";

export default async function ExplorePage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <>
    <PageHeader eyebrow="INTELLIGENCE / EXPLORE" title="情报探索" description="按关键词、主题、内容类型、来源、分数与时间组合查找已发布条目。" />
    <DataBanner preview={preview} />
    <ExploreClient items={preview.latest?.items ?? []} asOf={preview.latest?.asOf ?? new Date().toISOString()} />
    <div className="mt-5"><ScopeNote>当前未建立全量历史搜索索引。时间筛选以最近有效采集的 asOf 为基准；仓库按最近 Push 时间筛选。</ScopeNote></div>
  </>;
}

import { DataBanner, PageHeader, ScopeNote } from "../../components/page-frame";
import { TopicExplorer } from "../../components/topic-explorer";
import { loadPreview } from "../../lib/preview-data";

export default async function TopicsPage() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return <>
    <PageHeader eyebrow="DISCOVER / TOPICS" title="主题雷达" description="使用当前 Profile 的正式主题体系查看已发布条目的实际分布。" />
    <DataBanner preview={preview} />
    <TopicExplorer items={preview.latest?.items ?? []} />
    <div className="mt-5"><ScopeNote>一个条目可匹配多个主题。这里是最新发布快照中的真实计数，不代表趋势或增长率。</ScopeNote></div>
  </>;
}

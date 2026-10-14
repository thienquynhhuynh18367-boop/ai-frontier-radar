import { ArrowUpRight, GitFork, Layers3, ScanSearch, TrendingUp } from "lucide-react";
import { PageHeader, DataBanner, ScopeNote } from "../components/page-frame";
import { ItemList } from "../components/item-list";
import { EmptyState, TopicTag } from "../components/radar-ui";
import { TopRepositories } from "../components/top-repositories";
import { loadPreview } from "../lib/preview-data";
import { sitePath } from "../lib/site-path";
import { diverseTopItems, formatCount, formatShanghai, topicCounts } from "../lib/web-data";
import { profile } from "../config/profile";

export default async function Home() {
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  const latest = preview.latest;
  const items = latest?.items ?? [];
  const topicRanking = [...topicCounts(items)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return <>
    <PageHeader eyebrow="DAILY INTELLIGENCE / TODAY" title="今日概览"
      description="用最近一批通过验证的数据，快速找到与你的关注方向相关的公开 AI 情报。"
      action={{ href: "/explore", label: "探索全部条目" }} />
    <DataBanner preview={preview} />
    {!latest ? <EmptyState title="还没有可用的雷达数据" description={preview.message} /> : <>
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "本次扫描候选", value: formatCount(latest.receivedCount), icon: ScanSearch, note: "各来源返回项" },
          { label: "有效条目", value: formatCount(latest.itemCount), icon: GitFork, note: "含标记沿用的旧来源条目" },
          { label: "已识别主题", value: formatCount(topicRanking.length), icon: Layers3, note: "可一条命中多个主题" },
        ].map(({ label, value, icon: Icon, note }) => <div key={label} className="panel flex items-start justify-between p-3 sm:p-4">
          <div><p className="text-[10px] font-medium leading-4 text-[#687184] sm:text-[11px]">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#34384a] sm:text-2xl">{value}</p>
            <p className="mt-1 hidden text-[10px] text-[#a1a5b2] sm:block">{note}</p></div>
          <span className="hidden size-8 items-center justify-center rounded-lg bg-[#f3f1fd] text-[#7969cd] sm:flex"><Icon size={16} /></span>
        </div>)}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
        <section aria-labelledby="recommended-heading" className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3"><div>
            <p className="eyebrow mb-1">CURATED BY YOUR PROFILE</p>
            <h2 id="recommended-heading" className="text-lg font-semibold tracking-tight text-[#303448]">优先关注</h2>
          </div><span className="text-[11px] text-[#687184]">按 Personal Score 排序</span></div>
          <ItemList items={diverseTopItems(items)} pageSize={10} maxItems={10} compact emptyText="当前入选条目已被隐藏。可在我的收藏中恢复。" />
          <ScopeNote>Personal Score 是当前 Profile 的个人偏好排序，不表示行业权威排名；每个来源优先展示一条，仍只覆盖已发布采样。</ScopeNote>
        </section>
        <aside className="space-y-4">
          <section className="panel p-5"><div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#363a4e]">主题分布</h2><TrendingUp size={16} className="text-[#9e92dd]" /></div>
            {topicRanking.length ? <div className="space-y-3">{topicRanking.slice(0, 7).map(([id, count]) => {
              const topic = profile.topics.find((entry) => entry.id === id);
              return <div key={id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-[#666c7f]">{topic?.label ?? id}</span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eeeaf8]"><div className="h-full rounded-full bg-[#9a8be1]" style={{ width: `${count / items.length * 100}%` }} /></div>
                <strong className="w-5 text-right tabular-nums text-[#514789]">{count}</strong>
              </div>;
            })}</div> : <p className="text-xs text-[#9095a4]">当前没有可信主题匹配。</p>}
            <a href={sitePath("/topics")} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#6b59c8] hover:underline">查看全部主题 <ArrowUpRight size={12} /></a>
          </section>
          <TopRepositories items={items} />
          <section className="rounded-xl border border-[#e8e4fa] bg-[#f9f7ff] p-5">
            <p className="eyebrow mb-2">LATEST OBSERVATION</p>
            <p className="text-xs leading-6 text-[#6d688d]">业务日期 {latest.date}（Asia/Shanghai）。本次采集时间 {formatShanghai(latest.asOf)}。</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{topicRanking.slice(0, 3).map(([id]) => <TopicTag key={id} label={id} />)}</div>
          </section>
        </aside>
      </div>
    </>}
  </>;
}

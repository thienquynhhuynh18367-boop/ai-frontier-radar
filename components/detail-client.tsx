"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, GitFork, Star } from "lucide-react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { profile } from "../config/profile";
import { detailId, formatCount, formatShanghai, metadataNumber, metadataStrings,
  metadataText } from "../lib/web-data";
import { sitePath } from "../lib/site-path";
import { useSaved } from "./saved-provider";
import { EmptyState, SavedActions, ScoreBadge, ScoreBreakdown, TopicTag } from "./radar-ui";

export function DetailClient({ items }: { items: readonly IntelligenceItem[] }) {
  const [id, setId] = useState<string | null | undefined>(undefined);
  const { state } = useSaved();
  useEffect(() => {
    const timer = window.setTimeout(() => setId(detailId(window.location.search)), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (id === undefined) return <div role="status" className="panel p-8 text-center text-xs text-[#687184]">正在读取条目链接…</div>;
  if (!id) return <EmptyState title="链接缺少有效条目 ID" description="请从 Today、Explore、Topics 或 GitHub Radar 的条目卡片打开详情。" actionHref="/explore" actionLabel="前往探索" />;
  const item = items.find((candidate) => candidate.id === id);
  if (!item) {
    const prior = state.entries[id];
    return <EmptyState title={prior ? `${prior.snapshot.title} 暂不在当前发布数据中` : "当前发布数据中找不到此条目"}
      description={prior ? "本机状态仍保留，可在“我的收藏”中访问原始链接。旧评分与描述不再作为当前事实展示。" : "链接中的 ID 可能来自旧版本或其他日期；目前只加载最近一次有效发布。"}
      actionHref={prior ? "/saved" : "/explore"} actionLabel={prior ? "查看我的收藏" : "返回探索"} />;
  }
  const description = metadataText(item, "description");
  const isRepository = item.contentType === "repository";
  const rows = [
    ...(isRepository ? [["最近 Push", metadataText(item, "lastPushedAt")], ["仓库创建", metadataText(item, "createdAt")]] as const : []),
    ...(item.contentType === "paper" ? [["论文更新", metadataText(item, "updatedAt")]] as const : []),
    ...(item.sourceType === "sitemap" ? [["站点地图更新时间", metadataText(item, "lastmod")]] as const : []),
    ...(item.contentType === "job" ? [["岗位更新时间", metadataText(item, "updatedAt")]] as const : []),
    ["本系统首次发现", item.firstSeenAt],
    ["本次采集", item.collectedAt],
    ["原始发布时间", item.publishedAt],
  ] as const;
  const companies = item.companies.map((id) => profile.companies.find((company) => company.id === id)?.label ?? id);
  return <>
    <a href={sitePath("/explore")} className="focus-ring mb-5 inline-flex items-center gap-2 text-xs font-semibold text-[#777c8d] hover:text-[#6b59c8]"><ArrowLeft size={14} />返回探索</a>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
      <article className="panel min-w-0 p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#9185cb]"><GitFork size={14} />{item.contentType === "repository" ? "GitHub Repository" : item.contentType}
          <span className="font-normal text-[#6e7588]">· {item.source} · {item.sourceType}</span></div>
        {item.collectedAt < item.scoreBreakdown.asOf && <p className="mb-4 rounded-lg border border-[#f4e4cf] bg-[#fffbf5] p-3 text-xs text-[#8b6944]">此条沿用上次有效观测，最后采集于 {formatShanghai(item.collectedAt)}；当前评分按 {formatShanghai(item.scoreBreakdown.asOf)} 重算。</p>}
        <div className="flex flex-wrap items-start justify-between gap-4"><h1 className="max-w-3xl break-words text-2xl font-semibold leading-tight tracking-tight text-[#2e3245] sm:text-3xl">{item.title}</h1>
          <ScoreBadge value={item.personalScore} /></div>
        <p className="mt-4 break-words text-[13px] leading-7 text-[#696f82]">{description ?? (item.sourceType === "sitemap" ? "官方 Sitemap 未提供文章摘要；当前标题由 URL slug 显示。" : "来源未提供描述。")}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">{item.topics.length ? item.topics.map((topic) => <TopicTag key={topic} label={profile.topics.find((entry) => entry.id === topic)?.label ?? topic} />)
          : <span className="text-xs text-[#6e7588]">暂无可信主题匹配</span>}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-y border-[#f0f1f5] py-4 text-xs text-[#72788a]">
          {isRepository && <><span className="inline-flex items-center gap-1.5"><Star size={14} />{formatCount(metadataNumber(item, "stars"))} Stars</span>
          <span className="inline-flex items-center gap-1.5"><GitFork size={14} />{formatCount(metadataNumber(item, "forks"))} Forks</span>
          {metadataText(item, "language") && <span>语言：{metadataText(item, "language")}</span>}</>}
          {item.source === "hacker-news" && <><span>{formatCount(metadataNumber(item, "points"))} Points</span><span>{formatCount(metadataNumber(item, "comments"))} Comments</span></>}
          {item.contentType === "paper" && <><span>作者：{metadataStrings(item, "authors").join("、") || "未提供"}</span><span>分类：{metadataStrings(item, "categories").join("、") || "未提供"}</span></>}
          {item.contentType === "job" && <span>地点：{metadataText(item, "location") ?? "未提供"}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><SavedActions item={item} />
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[#6f5fd2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5c4bc1]">{item.source === "hacker-news" && item.url.startsWith("https://news.ycombinator.com/") ? "查看 HN 讨论" : "查看原文"} <ArrowUpRight size={13} /></a></div>
        <section className="mt-8"><h2 className="mb-4 text-base font-semibold text-[#3b3f52]">可核验元数据</h2>
          <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-lg border border-[#eef0f5] bg-[#fbfbfd] p-3">
            <dt className="mb-1 flex items-center gap-1.5 text-[11px] text-[#697285]"><CalendarDays size={12} />{label}</dt>
            <dd className="break-words text-xs font-medium text-[#5c6174]">{formatShanghai(value)}</dd></div>)}</dl>
        </section>
        <section className="mt-7"><h2 className="mb-3 text-base font-semibold text-[#3b3f52]">来源与标签</h2>
          {isRepository && <><p className="break-words text-[12px] leading-6 text-[#777d8e]">GitHub Owner：{metadataText(item, "owner") ?? "未提供"}</p>
          <p className="mt-1 break-words text-[12px] leading-6 text-[#777d8e]">GitHub Topics：{metadataStrings(item, "githubTopics").join(" · ") || "未提供"}</p></>}
          <p className="mt-1 text-[12px] leading-6 text-[#777d8e]">公司归属：{companies.join("、") || "证据不足，未标注"}</p>
          <ul className="mt-3 space-y-1">{item.sourceRefs.map((ref) => <li key={`${ref.source}:${ref.externalId}:${ref.url}`} className="break-all text-[11px]">
            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[#6b59c8] hover:underline">{ref.source} · {ref.url}</a>
          </li>)}</ul>
        </section>
      </article>
      <aside className="space-y-4"><section className="panel p-5"><p className="eyebrow mb-1">PERSONAL SCORE</p><h2 className="text-base font-semibold text-[#3b3f52]">评分构成</h2>
        <p className="mt-2 text-xs leading-6 text-[#687184]">各项为加权后的实际贡献点数，总和 {item.personalScore.toFixed(4)}。</p>
        <div className="mt-5"><ScoreBreakdown item={item} /></div>
        <p className="mt-4 border-t border-[#f0f1f5] pt-3 text-[11px] leading-5 text-[#687184]">Profile {item.scoreBreakdown.profileVersion} · asOf {formatShanghai(item.scoreBreakdown.asOf)}</p>
      </section>
      <section className="rounded-xl border border-[#e8e4f8] bg-[#faf9ff] p-5"><p className="eyebrow mb-2">INTERPRETATION</p>
        <p className="text-xs leading-6 text-[#77718f]">Personal Score 用于当前用户偏好排序。不同内容类型的热度量纲不直接比较；首次发现不代表原始发布时间。Sitemap 的 lastmod 只代表页面更新提示。</p></section></aside>
    </div>
  </>;
}

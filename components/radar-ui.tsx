"use client";

import { ArrowUpRight, Bookmark, BookmarkCheck, Check, Clock3, EyeOff, RotateCcw, Star, GitFork } from "lucide-react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { profile } from "../config/profile";
import { useSaved } from "./saved-provider";
import { detailHref, sitePath } from "../lib/site-path";
import { formatCount, formatShanghai, metadataNumber, metadataText, metadataStrings } from "../lib/web-data";

export function TopicTag({ label }: { label: string }) {
  return <span className="inline-flex rounded-md border border-[#e8e5f8] bg-[#f5f3ff] px-2 py-0.5 text-[11px] font-semibold text-[#7666c7]">{label}</span>;
}

export function ScoreBadge({ value }: { value: number }) {
  return <span title="Personal Score：个人偏好分，非行业权威排名" className="inline-flex shrink-0 items-baseline gap-1 rounded-lg border border-[#e4dffc] bg-[#f5f2ff] px-2.5 py-1.5 text-[#6754c7]">
    <strong className="text-[17px] leading-none tracking-tight">{value.toFixed(1)}</strong><small className="text-[10px] font-medium">/ 100</small>
  </span>;
}

export function ScoreBreakdown({ item }: { item: IntelligenceItem }) {
  const score = item.scoreBreakdown;
  const parts = [
    ["主题匹配", score.topic, 35], ["来源质量", score.source, 20],
    ["时效", score.freshness, 20], ["热度", score.popularity, 15],
    ["新颖度", score.novelty, 10],
  ] as const;
  return <div className="space-y-3">
    {parts.map(([label, value, maximum]) => <div key={label} className="grid grid-cols-[76px_1fr_64px] items-center gap-3 text-xs">
      <span className="text-[#73788b]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#edeaf8]"><div className="h-full rounded-full bg-[#8474d7]" style={{ width: `${value / maximum * 100}%` }} /></div>
      <span className="text-right tabular-nums text-[#555a6d]">{value.toFixed(2)} / {maximum}</span>
    </div>)}
    <p className="text-[11px] leading-5 text-[#687184]">基于固定采集时点与当前 Profile 的个人偏好评分；仓库热度并非 Star 增量。</p>
  </div>;
}

export function SavedActions({ item }: { item: IntelligenceItem }) {
  const { state, ready, toggle } = useSaved();
  const flags = state.entries[item.id];
  const base = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#7564d3] disabled:cursor-wait disabled:opacity-50";
  return <div className="flex flex-wrap gap-1.5" aria-label="个人状态操作">
    <button type="button" disabled={!ready} aria-pressed={Boolean(flags?.saved)} aria-label={flags?.saved ? "取消收藏" : "收藏"}
      onClick={() => toggle(item, "saved")} className={`${base} ${flags?.saved ? "border-[#d9d1f8] bg-[#f5f2ff] text-[#6b59c8]" : "border-[#e7e9ef] bg-white text-[#73798a] hover:text-[#6754c7]"}`}>
      {flags?.saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}{flags?.saved ? "已收藏" : "收藏"}
    </button>
    <button type="button" disabled={!ready} aria-pressed={Boolean(flags?.read)} aria-label={flags?.read ? "标记未读" : "标记已读"}
      onClick={() => toggle(item, "read")} className={`${base} border-[#e7e9ef] bg-white text-[#73798a] hover:text-[#6754c7]`}>
      <Check size={13} />{flags?.read ? "已读" : "标记已读"}
    </button>
    <button type="button" disabled={!ready} aria-pressed={Boolean(flags?.hidden)} aria-label={flags?.hidden ? "恢复显示" : "隐藏条目"}
      onClick={() => toggle(item, "hidden")} className={`${base} border-[#e7e9ef] bg-white text-[#73798a] hover:text-[#6754c7]`}>
      {flags?.hidden ? <RotateCcw size={13} /> : <EyeOff size={13} />}{flags?.hidden ? "恢复" : "隐藏"}
    </button>
  </div>;
}

export function IntelligenceCard({ item, compact = false }: { item: IntelligenceItem; compact?: boolean }) {
  const description = metadataText(item, "description");
  const stars = metadataNumber(item, "stars");
  const forks = metadataNumber(item, "forks");
  const pushed = metadataText(item, "lastPushedAt");
  return <article className={`panel min-w-0 ${compact ? "p-4" : "p-5"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[.11em] text-[#697285]">
          <span>GitHub Repository</span><span className="size-1 rounded-full bg-[#c4c6d2]" />
          <span>{pushed ? `最近 Push ${formatShanghai(pushed, false)}` : "Push 时间未知"}</span>
        </div>
        <h3 className="break-words text-[15px] font-semibold leading-6 tracking-[-.01em] text-[#2b2f42]">
          <a href={detailHref(item.id)} className="rounded-sm hover:text-[#6754c7] focus-visible:outline-2 focus-visible:outline-[#7564d3]">{item.title}</a>
        </h3>
      </div>
      <ScoreBadge value={item.personalScore} />
    </div>
    <p className={`mt-2 break-words text-[13px] leading-6 text-[#6d7385] ${compact ? "line-clamp-2" : "line-clamp-3"}`}>
      {description ?? "该仓库未提供描述。"}
    </p>
    <div className="mt-3 flex flex-wrap gap-1.5">{item.topics.length ? item.topics.map((topic) =>
      <TopicTag key={topic} label={profile.topics.find((entry) => entry.id === topic)?.label ?? topic} />)
      : <span className="text-[11px] text-[#697285]">尚无可信主题匹配</span>}</div>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#f0f1f5] pt-3 text-[11px] text-[#777d8f]">
      <span className="inline-flex items-center gap-1.5"><Star size={13} />{formatCount(stars)} Stars</span>
      <span className="inline-flex items-center gap-1.5"><GitFork size={13} />{formatCount(forks)} Forks</span>
      {metadataText(item, "language") && <span>{metadataText(item, "language")}</span>}
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-semibold text-[#6b59c8] hover:underline focus-visible:outline-2 focus-visible:outline-[#7564d3]">
        打开 GitHub <ArrowUpRight size={12} />
      </a>
    </div>
    {!compact && <>
      {metadataStrings(item, "githubTopics").length > 0 && <p className="mt-2 break-words text-[11px] leading-5 text-[#697285]">GitHub Topics：{metadataStrings(item, "githubTopics").join(" · ")}</p>}
      <details className="mt-3 rounded-lg bg-[#f8f8fc] px-3 py-2 text-xs text-[#6b59c8]">
        <summary className="cursor-pointer select-none font-medium focus-visible:outline-2 focus-visible:outline-[#7564d3]">查看评分依据</summary>
        <div className="mt-3"><ScoreBreakdown item={item} /></div>
      </details>
    </>}
    <div className="mt-3"><SavedActions item={item} /></div>
  </article>;
}

export function EmptyState({ title, description, actionHref, actionLabel }: {
  title: string; description: string; actionHref?: string; actionLabel?: string;
}) {
  return <div className="panel flex min-h-[190px] flex-col items-center justify-center px-6 py-9 text-center">
    <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-[#f2efff] text-[#7564d3]"><Clock3 size={19} /></div>
    <h2 className="text-base font-semibold text-[#313549]">{title}</h2>
    <p className="mt-2 max-w-lg text-[13px] leading-6 text-[#858a9b]">{description}</p>
    {actionHref && actionLabel && <a href={sitePath(actionHref)} className="mt-4 rounded-lg bg-[#6f5fd2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5c4bc1] focus-visible:outline-2 focus-visible:outline-[#7564d3]">{actionLabel}</a>}
  </div>;
}

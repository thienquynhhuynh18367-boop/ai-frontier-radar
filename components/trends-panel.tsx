"use client";

import { useState } from "react";
import { Activity, CalendarDays, CircleDashed } from "lucide-react";
import { profile } from "../config/profile";
import type { TrendWindow } from "../lib/trend-data";

export function TrendsPanel({ windows, latestTopics, sourceCounts, latestDate }: {
  windows: TrendWindow[]; latestTopics: [string, number][];
  sourceCounts: [string, number][]; latestDate: string | null;
}) {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const current = windows.find((window) => window.days === days)!;
  const latestTotal = sourceCounts.reduce((sum, [, count]) => sum + count, 0);
  return <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow mb-1">OBSERVATION WINDOW</p><h2 className="text-lg font-semibold text-[#35394d]">主题趋势</h2></div>
      <div role="tablist" aria-label="趋势时间窗口" className="flex rounded-lg border border-[#e4e6ef] bg-white p-1">
        {([7, 30, 90] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={days === value}
          onClick={() => setDays(value)} className={`focus-ring rounded-md px-4 py-2 text-xs font-semibold ${days === value ? "bg-[#eeeafa] text-[#6b59c8]" : "text-[#687184] hover:text-[#45495b]"}`}>{value} 天</button>)}
      </div>
    </div>
    {current.ready ? <section role="tabpanel" className="panel p-5 sm:p-6">
      <p className="mb-5 text-[12px] leading-6 text-[#868b9b]">最近 {days} 个完整业务日与前 {days} 日相比。数量是每日已发布快照中的主题条目次，同一仓库跨日可重复出现。</p>
      <div className="space-y-3">{current.topics.map((topic) => <div key={topic.id} className="grid grid-cols-[minmax(0,1fr)_56px_56px_70px] items-center gap-3 border-b border-[#f1f2f6] py-2 text-xs last:border-0">
        <strong className="truncate font-medium text-[#494d60]">{profile.topics.find((entry) => entry.id === topic.id)?.label ?? topic.id}</strong>
        <span className="text-right tabular-nums text-[#5f557d]">{topic.current}</span>
        <span className="text-right tabular-nums text-[#687184]">{topic.previous}</span>
        <span className="text-right font-semibold tabular-nums text-[#6e5dc8]">{topic.growthRate === null ? "无基线" : `${topic.growthRate >= 0 ? "+" : ""}${(topic.growthRate * 100).toFixed(1)}%`}</span>
      </div>)}</div>
    </section> : <section role="tabpanel" className="panel flex min-h-[230px] flex-col items-center justify-center p-6 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-[#f3f1fd] text-[#8271d2]"><CircleDashed size={20} /></span>
      <h3 className="text-base font-semibold text-[#393d50]">历史观测不足</h3>
      <p className="mt-2 max-w-lg text-[12px] leading-6 text-[#8a8fa0]">可靠的 {days} 天增长率需要连续 {days * 2} 个已发布业务日，目前有 {current.observedDays} 天有效快照。不会从单日数据推断 Rising、Cooling 或 Star Growth。</p>
    </section>}
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="panel p-5"><div className="mb-4 flex items-center gap-2"><Activity size={16} className="text-[#8878d7]" /><h3 className="text-sm font-semibold text-[#3c4054]">已观测的单日主题</h3></div>
        <p className="mb-4 text-[11px] text-[#6e7588]">{latestDate ?? "暂无业务日"} · 事实计数，不是趋势判断</p>
        {latestTopics.length ? <div className="space-y-3">{latestTopics.slice(0, 9).map(([topic, count]) => <div key={topic} className="flex items-center gap-3 text-xs">
          <span className="w-28 truncate text-[#6b7083]">{profile.topics.find((entry) => entry.id === topic)?.label ?? topic}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0edf8]"><div className="h-full rounded-full bg-[#9b8be1]" style={{ width: `${count / latestTotal * 100}%` }} /></div>
          <strong className="w-6 text-right tabular-nums text-[#5f557d]">{count}</strong></div>)}</div>
          : <p className="text-[12px] text-[#999eac]">目前没有已识别主题。</p>}
      </section>
      <section className="panel p-5"><div className="mb-4 flex items-center gap-2"><CalendarDays size={16} className="text-[#8878d7]" /><h3 className="text-sm font-semibold text-[#3c4054]">已观测的来源构成</h3></div>
        <p className="mb-4 text-[11px] text-[#6e7588]">仅统计当前最新已发布条目</p>
        {sourceCounts.length ? sourceCounts.map(([source, count]) => <div key={source} className="mb-3 flex items-center justify-between rounded-lg border border-[#ececf4] bg-[#fbfbfe] px-3 py-3 text-xs">
          <span className="font-medium text-[#62677a]">{source === "github" ? "GitHub Search" : source}</span><strong className="tabular-nums text-[#6d5cc8]">{count} 条</strong>
        </div>) : <p className="text-[12px] text-[#999eac]">暂无已发布来源数据。</p>}
        <p className="mt-3 text-[11px] leading-5 text-[#6e7588]">未接入来源不会显示为 0 条采集结果。</p>
      </section>
    </div>
  </>;
}

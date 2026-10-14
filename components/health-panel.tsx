"use client";

import { useEffect, useState } from "react";
import { Activity, Clock3, CircleDashed } from "lucide-react";
import type { Manifest, SourceStatus } from "../types/publication";
import { sourceRuns } from "../lib/source-health";
import { isDataStale } from "../lib/freshness";
import { formatCount, formatShanghai } from "../lib/web-data";

const planned = ["GitHub Trending", "Hugging Face", "创业公司专门来源", "融资公告"];
const labels = { success: "成功", empty: "成功但无入选", partial: "部分失败", failed: "失败",
  schema_failed: "结构错误", anomaly: "数据异常", carried: "沿用旧数据" } as const;

export function HealthPanel({ health, manifest, latestAsOf, staleAtBuild }: {
  health: SourceStatus | null; manifest: Manifest | null; latestAsOf: string | null; staleAtBuild: boolean;
}) {
  const [stale, setStale] = useState(staleAtBuild);
  useEffect(() => {
    const update = () => setStale(latestAsOf ? isDataStale(latestAsOf, new Date().toISOString()) : false);
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [latestAsOf]);
  const runs = sourceRuns(health);
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="panel p-4"><Activity size={16} className="text-[#8273d3]" /><p className="mt-2 text-[11px] text-[#687184]">已接入来源</p><strong className="text-xl">{runs.length}</strong></div>
      <div className="panel p-4"><Clock3 size={16} className="text-[#8273d3]" /><p className="mt-2 text-[11px] text-[#687184]">有效数据时效</p><strong className="text-sm">{latestAsOf ? stale ? "超过 48 小时" : "48 小时内" : "暂无有效数据"}</strong></div>
      <div className="panel p-4"><CircleDashed size={16} className="text-[#8273d3]" /><p className="mt-2 text-[11px] text-[#687184]">历史快照</p><strong className="text-xl">{manifest?.dates.length ?? 0}</strong></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">{runs.map((run) => <section key={run.source} className="panel p-5" aria-label={`${run.source} 运行状态`}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-[#373b4f]">{run.source}</h2>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${["success", "empty"].includes(run.status) ? "bg-[#eaf8f3] text-[#348e70]" : "bg-[#fff2e5] text-[#a56d37]"}`}>{labels[run.status]}</span></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-[#697285]">
        {[["最近尝试", formatShanghai(run.lastAttemptAt)], ["最近成功", formatShanghai(run.lastSuccessAt)],
          ["接收候选", formatCount(run.receivedCount)], ["入选原始条目", formatCount(run.acceptedCount)],
          ["发布引用条目", formatCount(run.itemCount)], ["沿用旧条目", formatCount(run.carriedCount)],
          ["连续失败", formatCount(run.consecutiveFailures)]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd className="mt-1 break-words font-semibold text-[#555a6e]">{value}</dd></div>)}
      </dl>
      {run.queryStats.length > 0 && <details className="mt-4 border-t border-[#f0f1f5] pt-3 text-[11px]"><summary className="cursor-pointer text-[#6b59c8]">逐查询采集质量</summary>
        <div className="mt-2 space-y-1">{run.queryStats.map((stat) => <p key={stat.id}>{stat.id}：请求 {stat.requests} / 接收 {stat.received} / 窗口内 {stat.accepted} / 拒绝 {stat.rejected}</p>)}</div>
      </details>}
      {run.errorCodes.length > 0 && <p className="mt-3 rounded-lg bg-[#fffbf5] p-3 text-[11px] text-[#8b6944]">错误：{run.errorCodes.join("、")}。旧条目的时间不会改写成今天的新发现。</p>}
    </section>)}</div>
    <section className="mt-7"><h2 className="mb-3 text-lg font-semibold">尚未接入</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {planned.map((name) => <div key={name} className="panel p-4 text-[12px] text-[#687184]">{name}<p className="mt-1 text-[11px]">暂无可信可发布数据</p></div>)}
    </div></section>
  </>;
}

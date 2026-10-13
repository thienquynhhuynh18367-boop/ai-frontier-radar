"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, CircleDashed, Clock3 } from "lucide-react";
import type { Manifest, SourceStatus } from "../types/publication";
import { isDataStale } from "../lib/freshness";
import { formatCount, formatShanghai } from "../lib/web-data";

const planned = [
  ["GitHub Trending", "仓库趋势页面"], ["Hacker News", "帖子与讨论"],
  ["arXiv", "论文元数据"], ["OpenAI 官方站", "公司与产品更新"],
  ["Anthropic 官方站", "公司与产品更新"], ["Hugging Face", "公开 Hub 元数据"],
  ["产品 / 创业 / 融资 / 岗位", "具体免费来源待核实"],
] as const;

const labels = { success: "成功", empty: "成功但无入选数据", partial: "部分失败",
  failed: "失败", schema_failed: "结构校验失败", anomaly: "数据异常" } as const;

export function HealthPanel({ health, manifest, latestAsOf, staleAtBuild }: {
  health: SourceStatus | null; manifest: Manifest | null;
  latestAsOf: string | null; staleAtBuild: boolean;
}) {
  const [stale, setStale] = useState(staleAtBuild);
  useEffect(() => {
    const update = () => setStale(latestAsOf ? isDataStale(latestAsOf, new Date().toISOString()) : false);
    const timer = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [latestAsOf]);
  const failure = health && health.status !== "success" && health.status !== "empty";
  return <>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="panel p-4"><div className="mb-2 flex items-center gap-2 text-[#8273d3]"><Activity size={15} /><span className="text-[11px] font-semibold text-[#687184]">已接入来源</span></div>
        <strong className="text-xl tabular-nums text-[#35394c]">1</strong><p className="mt-1 text-[11px] text-[#6e7588]">GitHub Repository Search</p></div>
      <div className="panel p-4"><div className="mb-2 flex items-center gap-2 text-[#8273d3]"><Clock3 size={15} /><span className="text-[11px] font-semibold text-[#687184]">数据时效</span></div>
        <strong className={`text-sm ${stale ? "text-[#a97136]" : "text-[#399779]"}`}>{latestAsOf ? stale ? "已超过 48 小时" : "48 小时内" : "暂无有效数据"}</strong>
        <p className="mt-1 text-[11px] text-[#6e7588]">以浏览器当前时间判断</p></div>
      <div className="panel p-4"><div className="mb-2 flex items-center gap-2 text-[#8273d3]"><CheckCircle2 size={15} /><span className="text-[11px] font-semibold text-[#687184]">历史快照</span></div>
        <strong className="text-xl tabular-nums text-[#35394c]">{manifest?.dates.length ?? 0}</strong><p className="mt-1 text-[11px] text-[#6e7588]">已发布业务日</p></div>
    </div>
    <section className="panel p-5 sm:p-6" aria-labelledby="github-health-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <p className="eyebrow mb-1">CONNECTED SOURCE</p>
        <h2 id="github-health-title" className="text-base font-semibold text-[#373b4f]">GitHub Search</h2>
        <p className="mt-1 text-[11px] text-[#697285]">公开仓库 · GitHub REST API</p></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${!health ? "bg-[#f3f4f7] text-[#83889a]" : failure ? "bg-[#fff2e5] text-[#a56d37]" : "bg-[#eaf8f3] text-[#348e70]"}`}>
          {!health ? <CircleDashed size={12} /> : failure ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
          {health ? labels[health.status] : "状态记录缺失"}
        </span></div>
      {health ? <>
        <dl className="mt-6 grid gap-x-5 gap-y-4 border-t border-[#f0f1f5] pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["最近尝试", formatShanghai(health.lastAttemptAt)], ["最近成功", formatShanghai(health.lastSuccessAt)],
            ["本次接收候选", formatCount(health.receivedCount)], ["本次入选", formatCount(health.acceptedCount)],
            ["最近有效发布", formatCount(health.itemCount)], ["数据是否过期", latestAsOf ? stale ? "是" : "否" : "无有效数据"],
          ].map(([label, value]) => <div key={label}><dt className="text-[11px] text-[#687184]">{label}</dt>
            <dd className="mt-1 break-words text-[12px] font-semibold text-[#555a6e]">{value}</dd></div>)}
        </dl>
        {health.errorCodes.length > 0 && <div className="mt-5 rounded-lg border border-[#f4e4cf] bg-[#fffbf5] p-3 text-[11px] text-[#8b6944]">
          错误摘要：{health.errorCodes.join("、")}。下方有效数据保持上次成功版本，不将失败标作新数据。
        </div>}
      </> : <p className="mt-5 text-[12px] leading-6 text-[#687184]">尚无有效的 sources-status.json。可先运行本地采集任务并重新构建。</p>}
    </section>
    <section className="mt-7"><div className="mb-4"><p className="eyebrow mb-1">NOT CONNECTED</p><h2 className="text-lg font-semibold text-[#373b4f]">计划中的来源</h2>
      <p className="mt-1 text-[11px] text-[#6e7588]">未接入表示尚未建立 Collector，不代表采集故障。</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{planned.map(([name, type]) => <div key={name} className="panel flex items-start gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f8] text-[#a2a5b2]"><CircleDashed size={15} /></span>
        <div className="min-w-0"><strong className="block text-[12px] text-[#5d6275]">{name}</strong>
          <span className="mt-1 block text-[11px] text-[#6e7588]">{type}</span>
          <span className="mt-2 inline-block rounded-md bg-[#f4f4f7] px-2 py-0.5 text-[10px] font-semibold text-[#687184]">未接入</span></div>
      </div>)}</div>
    </section>
  </>;
}

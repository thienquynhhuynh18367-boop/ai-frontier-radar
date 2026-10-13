import { AlertCircle, ArrowUpRight, Database, Info } from "lucide-react";
import type { Preview } from "../lib/preview-data";
import { formatShanghai } from "../lib/web-data";
import { sitePath } from "../lib/site-path";
import { FreshnessStatus } from "../app/freshness-status";

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string;
  action?: { href: string; label: string };
}) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="max-w-3xl"><p className="eyebrow mb-2">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="mt-2 text-[13px] leading-6 text-[#83889a]">{description}</p>
    </div>
    {action && <a href={sitePath(action.href)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2def8] bg-white px-3 py-2 text-xs font-semibold text-[#6d5cc8] hover:bg-[#f6f3ff] focus-visible:outline-2 focus-visible:outline-[#7564d3]">
      {action.label}<ArrowUpRight size={14} /></a>}
  </div>;
}

export function DataBanner({ preview }: { preview: Preview }) {
  if (!preview.latest) return <div role="status" className="mb-6 flex items-start gap-3 rounded-xl border border-[#f3dcc5] bg-[#fffaf4] px-4 py-3 text-[12px] leading-5 text-[#8c613b]">
    <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{preview.message}</span></div>;
  const issue = preview.stale || !preview.health || preview.health.status !== "success";
  return <div role="status" className={`mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-3 text-[12px] ${issue ? "border-[#f0ddc5] bg-[#fffbf5] text-[#85633f]" : "border-[#e5e8f2] bg-white text-[#74798c]"}`}>
    {issue ? <AlertCircle size={15} className="shrink-0" /> : <Database size={15} className="shrink-0 text-[#7869cc]" />}
    <span>{preview.message}</span>
    <span>有效数据：<time dateTime={preview.latest.asOf}>{formatShanghai(preview.latest.asOf)}</time></span>
    <span>范围：GitHub Search 已发布采样</span>
    <FreshnessStatus asOf={preview.latest.asOf} staleAtBuild={preview.stale} />
    <a href={sitePath("/health")} className="ml-auto inline-flex items-center gap-1 font-semibold text-[#7060c7] hover:underline">查看来源状态 <ArrowUpRight size={12} /></a>
  </div>;
}

export function ScopeNote({ children }: { children: React.ReactNode }) {
  return <p className="inline-flex items-start gap-2 text-[11px] leading-5 text-[#697285]"><Info size={13} className="mt-0.5 shrink-0" />{children}</p>;
}

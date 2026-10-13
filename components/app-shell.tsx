"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Activity, ArrowUpRight, BriefcaseBusiness, Building2, Compass, FlaskConical,
  GitFork, Heart, LayoutDashboard, Menu, Package, Search, Sparkles, TrendingUp, Wallet, X } from "lucide-react";
import { sitePath } from "../lib/site-path";
import { isDataStale } from "../lib/freshness";
import type { SourceStatus } from "../types/publication";

const groups = [
  { label: "工作台", links: [
    { href: "/", label: "今日概览", icon: LayoutDashboard },
    { href: "/explore", label: "情报探索", icon: Search },
    { href: "/topics", label: "主题雷达", icon: Compass },
    { href: "/trends", label: "趋势观察", icon: TrendingUp },
  ] },
  { label: "来源雷达", links: [
    { href: "/github", label: "GitHub Radar", icon: GitFork },
    { href: "/products", label: "产品雷达", icon: Package },
    { href: "/startups", label: "创业雷达", icon: Building2 },
    { href: "/funding", label: "融资雷达", icon: Wallet },
    { href: "/research", label: "研究雷达", icon: FlaskConical },
    { href: "/career", label: "职业雷达", icon: BriefcaseBusiness },
  ] },
  { label: "个人与系统", links: [
    { href: "/saved", label: "我的收藏", icon: Heart },
    { href: "/health", label: "数据源状态", icon: Activity },
  ] },
] as const;

function routeName(pathname: string): string {
  if (pathname.includes("/detail")) return "条目详情";
  for (const group of groups) for (const link of group.links) {
    if (activeRoute(pathname, link.href)) return link.label;
  }
  return "今日概览";
}

function activeRoute(pathname: string, href: string): boolean {
  const base = process.env.NEXT_PUBLIC_RADAR_BASE_PATH ?? "";
  const current = base && pathname.startsWith(base + "/") ? pathname.slice(base.length) : pathname;
  return current.replace(/\/$/, "") === href.replace(/\/$/, "");
}

export function AppShell({ children, health, asOf, staleAtBuild }: {
  children: React.ReactNode; health: SourceStatus | null; asOf: string | null; staleAtBuild: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stale, setStale] = useState(staleAtBuild);
  useEffect(() => {
    if (!asOf) return;
    const update = () => setStale(isDataStale(asOf, new Date().toISOString()));
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [asOf]);
  const current = routeName(pathname);
  const statusLabel = !asOf ? "暂无数据" : stale ? "数据已过期"
    : !health ? "状态待确认" : health.status === "empty" ? "本次无入选"
      : health.status !== "success" ? "采集需关注" : "数据已发布";
  return <div className="min-h-screen bg-[#f6f7fb] text-[#202436]">
    {open && <button type="button" aria-label="关闭导航遮罩" onClick={() => setOpen(false)}
      className="fixed inset-0 z-40 bg-slate-950/35 lg:hidden" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-[#e7e9f1] bg-[#fcfcff] transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[76px] items-center gap-3 border-b border-[#edf0f5] px-5">
        <a href={sitePath("/")} onClick={() => setOpen(false)} aria-label="AI Frontier Radar 首页"
          className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[#7564d3]">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#6f5fd2] text-[13px] font-bold tracking-tight text-white shadow-[0_5px_12px_rgba(111,95,210,.22)]">FR</span>
          <span className="min-w-0"><strong className="block text-[13px] leading-4 tracking-tight">AI Frontier Radar</strong>
            <small className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[.17em] text-[#9a9dae]">INTELLIGENCE DESK</small></span>
        </a>
        <button type="button" aria-label="关闭导航" onClick={() => setOpen(false)} className="ml-auto rounded-md p-1 text-slate-500 lg:hidden"><X size={18} /></button>
      </div>
      <nav aria-label="主导航" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {groups.map((group) => <div key={group.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[#697285]">{group.label}</p>
          <div className="space-y-0.5">{group.links.map(({ href, label, icon: Icon }) => {
            const active = activeRoute(pathname, href);
            return <a key={href} href={sitePath(href)} aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#7564d3] ${active ? "bg-[#eeebfc] text-[#6350c8]" : "text-[#666c7f] hover:bg-[#f1f2f7] hover:text-[#202436]"}`}>
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span>
            </a>;
          })}</div>
        </div>)}
      </nav>
      <div className="m-3 rounded-xl border border-[#e9e6f6] bg-[#f8f6ff] px-3.5 py-3">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-[#6c5cc6]"><Sparkles size={13} /> 当前数据范围</div>
        <p className="text-xs leading-5 text-[#74778a]">仅覆盖 GitHub Search 已发布采样；其他来源等待接入。</p>
      </div>
    </aside>
    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-[#e9ebf1] bg-white/95 px-4 backdrop-blur sm:px-7 lg:px-9">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="打开导航" aria-expanded={open} onClick={() => setOpen(true)}
            className="rounded-lg border border-[#e7e9f1] p-2 text-slate-600 lg:hidden"><Menu size={19} /></button>
          <div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#a0a5b4]">RADAR / WORKSPACE</p>
            <p className="truncate text-[14px] font-semibold text-[#303448]">{current}</p></div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href={sitePath("/health")} className="inline-flex items-center gap-2 rounded-full border border-[#e8eaf1] px-3 py-1.5 text-[11px] font-medium text-[#6e7487] hover:border-[#b9b0eb] focus-visible:outline-2 focus-visible:outline-[#7564d3]">
            <span className={`size-1.5 rounded-full ${asOf && health?.status === "success" && !stale ? "bg-emerald-500" : "bg-amber-500"}`} />{statusLabel}
          </a>
          <a href={sitePath("/explore")} className="hidden items-center gap-1.5 rounded-lg bg-[#6f5fd2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5c4bc1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7564d3] sm:inline-flex">
            探索数据 <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1420px] px-4 pb-16 pt-7 sm:px-7 lg:px-9 lg:pt-9">{children}</main>
    </div>
  </div>;
}

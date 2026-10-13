"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { profile } from "../config/profile";
import { defaultFilters, filterItems, type ItemFilters } from "../lib/web-data";
import { ItemList } from "./item-list";
import { useSaved } from "./saved-provider";

const contentTypes = [
  ["repository", "GitHub 仓库"], ["news", "新闻"], ["paper", "论文"],
  ["product", "产品"], ["startup", "创业"], ["funding", "融资"],
  ["job", "岗位"], ["company_update", "公司动态"],
] as const;

const control = "focus-ring w-full min-w-0 rounded-lg border border-[#e5e7ef] bg-white px-3 py-2.5 text-[12px] text-[#4c5165] outline-none hover:border-[#c8c1e9]";

export function ExploreClient({ items, asOf, githubOnly = false }: {
  items: readonly IntelligenceItem[]; asOf: string; githubOnly?: boolean;
}) {
  const [filters, setFilters] = useState<ItemFilters>({ ...defaultFilters,
    contentType: githubOnly ? "repository" : "all" });
  const [showHidden, setShowHidden] = useState(false);
  const { state } = useSaved();
  const update = <K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const filtered = useMemo(() => filterItems(items, filters, asOf)
    .filter((item) => showHidden || !state.entries[item.id]?.hidden), [items, filters, asOf, showHidden, state]);
  const options = githubOnly ? items.filter((item) => item.contentType === "repository") : items;
  return <>
    <section aria-label="搜索和筛选" className="panel mb-5 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-[12px] font-semibold text-[#5c6075]"><SlidersHorizontal size={15} className="text-[#7a6bd1]" /> 搜索与筛选</div>
      <label className="relative block"><span className="sr-only">搜索标题、描述、Owner 和标签</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6e7588]" />
        <input type="search" value={filters.query} onChange={(event) => update("query", event.target.value)}
          placeholder="搜索仓库名、描述、Owner 或 GitHub Topics…" className={`${control} pl-9`} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-[11px] font-medium text-[#687184]">主题
          <select value={filters.topic} onChange={(event) => update("topic", event.target.value)} className={`mt-1 ${control}`}>
            <option value="all">全部主题</option>{profile.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
          </select>
        </label>
        {!githubOnly && <label className="text-[11px] font-medium text-[#687184]">内容类型
          <select value={filters.contentType} onChange={(event) => update("contentType", event.target.value)} className={`mt-1 ${control}`}>
            <option value="all">全部类型</option>{contentTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>}
        {!githubOnly && <label className="text-[11px] font-medium text-[#687184]">来源
          <select value={filters.source} onChange={(event) => update("source", event.target.value)} className={`mt-1 ${control}`}>
            <option value="all">全部已接入来源</option><option value="github">GitHub Search</option>
          </select>
        </label>}
        <label className="text-[11px] font-medium text-[#687184]">活动时间
          <select value={filters.time} onChange={(event) => update("time", event.target.value as ItemFilters["time"])} className={`mt-1 ${control}`}>
            <option value="all">不限时间</option><option value="1d">采集时点前 1 天</option>
            <option value="7d">采集时点前 7 天</option><option value="30d">采集时点前 30 天</option>
            <option value="90d">采集时点前 90 天</option>
          </select>
        </label>
        <label className="text-[11px] font-medium text-[#687184]">最低分
          <input type="number" min="0" max="100" step="1" value={filters.minScore}
            onChange={(event) => update("minScore", Math.min(100, Math.max(0, Number(event.target.value))))} className={`mt-1 ${control}`} />
        </label>
        <label className="text-[11px] font-medium text-[#687184]">最高分
          <input type="number" min="0" max="100" step="1" value={filters.maxScore}
            onChange={(event) => update("maxScore", Math.min(100, Math.max(0, Number(event.target.value))))} className={`mt-1 ${control}`} />
        </label>
        <label className="text-[11px] font-medium text-[#687184]">排序
          <select value={filters.sort} onChange={(event) => update("sort", event.target.value as ItemFilters["sort"])} className={`mt-1 ${control}`}>
            <option value="score">Personal Score：高到低</option><option value="score-asc">Personal Score：低到高</option>
            <option value="pushed">最近活动：新到旧</option><option value="stars">Stars：多到少</option>
            <option value="name">仓库名称：A 到 Z</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0f1f5] pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#757a8d]">
          <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} className="accent-[#6f5fd2]" />包含已隐藏条目
        </label>
        <button type="button" onClick={() => { setFilters({ ...defaultFilters, contentType: githubOnly ? "repository" : "all" }); setShowHidden(false); }}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-[#7060c7] hover:bg-[#f4f1ff]"><RotateCcw size={12} />重置筛选</button>
      </div>
    </section>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-[#414559]">结果 <span className="ml-1 tabular-nums text-[#6c5cc6]">{filtered.length}</span></h2>
      <p className="text-[11px] text-[#687184]">当前发布数据共 {options.length} 条；搜索不覆盖 GitHub 全站或未发布历史</p>
    </div>
    <ItemList items={filtered} showHidden emptyText="可调整关键词、主题、时间或分数；当前只检索已加载的公开 JSON。" />
  </>;
}

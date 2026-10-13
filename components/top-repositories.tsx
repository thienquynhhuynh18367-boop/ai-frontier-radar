"use client";

import { Star } from "lucide-react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { formatCount, metadataNumber } from "../lib/web-data";
import { useSaved } from "./saved-provider";

export function TopRepositories({ items }: { items: readonly IntelligenceItem[] }) {
  const { state } = useSaved();
  const top = items.filter((item) => !state.entries[item.id]?.hidden)
    .sort((a, b) => (metadataNumber(b, "stars") ?? -1) - (metadataNumber(a, "stars") ?? -1)
      || a.id.localeCompare(b.id)).slice(0, 3);
  return <section className="panel p-5"><h2 className="mb-1 text-sm font-semibold text-[#363a4e]">重点 GitHub 仓库</h2>
    <p className="mb-4 text-[11px] leading-5 text-[#687184]">按当前可核验 Stars 排列，不代表近期增长。</p>
    <div className="space-y-4">{top.map((item, index) => <div key={item.id} className="flex gap-3 border-b border-[#f0f1f5] pb-3 last:border-0 last:pb-0">
      <span className="text-[11px] font-bold tabular-nums text-[#697285]">0{index + 1}</span>
      <div className="min-w-0"><a href={item.url} target="_blank" rel="noopener noreferrer" className="block break-words text-[12px] font-semibold text-[#41455a] hover:text-[#6b59c8]">{item.title}</a>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#697285]"><Star size={11} />{formatCount(metadataNumber(item, "stars"))}</span></div>
    </div>)}</div>
  </section>;
}

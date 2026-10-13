"use client";

import { useState } from "react";
import { ArrowRight, Hash } from "lucide-react";
import { profile } from "../config/profile";
import type { IntelligenceItem } from "../types/intelligence-item";
import { topicCounts } from "../lib/web-data";
import { ItemList } from "./item-list";

const priorities = { high: "高优先", medium: "中优先", low: "低优先" } as const;

export function TopicExplorer({ items }: { items: readonly IntelligenceItem[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const counts = topicCounts(items);
  const selectedTopic = profile.topics.find((topic) => topic.id === selected);
  const matching = selected ? items.filter((item) => item.topics.includes(selected)) : [];
  return <>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profile.topics.map((topic) => {
        const count = counts.get(topic.id) ?? 0;
        const active = selected === topic.id;
        return <button key={topic.id} type="button" aria-pressed={active} onClick={() => setSelected(topic.id)}
          className={`panel focus-ring group min-h-[105px] p-4 text-left transition-colors hover:border-[#bfb6ed] ${active ? "border-[#b6aae9] bg-[#fbfaff]" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#f3f1fd] text-[#8070d0]"><Hash size={15} /></span>
            <span className="text-[10px] font-semibold text-[#697285]">{priorities[topic.priority]}</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3"><div>
            <strong className="block text-[13px] text-[#393d50]">{topic.label}</strong>
            <span className="text-[11px] text-[#687184]">{count} 条真实条目</span></div>
            <ArrowRight size={15} className="text-[#b3abd8] transition-transform group-hover:translate-x-1" /></div>
        </button>;
      })}
    </div>
    <section id="topic-results" className="mt-8" aria-live="polite">
      <div className="mb-4 flex items-end justify-between"><div>
        <p className="eyebrow mb-1">TOPIC ITEMS</p>
        <h2 className="text-lg font-semibold text-[#35394d]">{selectedTopic ? `${selectedTopic.label} · ${matching.length} 条` : "选择一个主题查看条目"}</h2>
      </div>{selectedTopic && <button type="button" onClick={() => setSelected(null)} className="focus-ring text-xs font-semibold text-[#7161c8] hover:underline">清除选择</button>}</div>
      {selectedTopic ? <ItemList items={matching} emptyText="此主题在当前已发布采样中没有可信匹配；不代表 GitHub 全站没有相关仓库。" />
        : <div className="panel px-5 py-8 text-center text-[13px] text-[#697285]">点击上方主题，即可查看对应的已发布仓库。</div>}
    </section>
  </>;
}

"use client";

import { useRef, useState } from "react";
import { Download, FileUp, Link2Off } from "lucide-react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { exportSavedState } from "../lib/saved-state";
import { useSaved } from "./saved-provider";
import { EmptyState, IntelligenceCard } from "./radar-ui";
import { Button } from "./ui/button";

type Tab = "all" | "unread" | "hidden";

export function SavedPageClient({ items }: { items: readonly IntelligenceItem[] }) {
  const { state, ready, storageError, toggleExisting, importText } = useSaved();
  const [tab, setTab] = useState<Tab>("all");
  const [feedback, setFeedback] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = new Map(items.map((item) => [item.id, item]));
  const entries = Object.entries(state.entries).filter(([, entry]) => entry.saved)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt) || a[0].localeCompare(b[0]));
  const filtered = entries.filter(([, entry]) => tab === "all" || tab === "unread" && !entry.read || tab === "hidden" && entry.hidden);
  const orphanCount = entries.filter(([id]) => !current.has(id)).length;
  const download = () => {
    const blob = new Blob([exportSavedState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "ai-frontier-radar-saved.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setFeedback(`已导出 ${entries.length} 条收藏及其他本地标记。`);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.size > 1_000_000) throw new Error("too large");
      const count = importText(await file.text());
      setFeedback(`已校验并合并 ${count} 条本地状态；相同 ID 以导入文件为准。`);
    } catch {
      setFeedback("导入失败：文件不是有效的 AI Frontier Radar 收藏 JSON，原有状态未更改。");
    }
    if (input.current) input.current.value = "";
  };
  return <>
    <div className="panel mb-5 flex flex-wrap items-start justify-between gap-4 p-5">
      <div><p className="text-[11px] text-[#9297a6]">保存在当前浏览器</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-[#33374a]">{ready ? entries.length : "…"} <span className="text-xs font-medium text-[#9297a6]">条收藏</span></p>
        <p className="mt-1 text-[11px] text-[#6e7588]">{orphanCount} 条暂不在当前 latest 中，状态仍保留。</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!ready} onClick={download} className="focus-ring h-9 gap-2 px-3 text-xs"><Download size={14} />导出 JSON</Button>
        <Button type="button" disabled={!ready} onClick={() => input.current?.click()} className="focus-ring h-9 gap-2 px-3 text-xs"><FileUp size={14} />导入 JSON</Button>
        <input ref={input} type="file" accept=".json,application/json" aria-label="选择收藏 JSON 文件" className="sr-only" onChange={(event) => void importFile(event.target.files?.[0])} />
      </div>
    </div>
    <div className="mb-5 rounded-xl border border-[#e7e4f4] bg-[#faf9ff] px-4 py-3 text-[11px] leading-6 text-[#77728d]">
      收藏、已读与隐藏只保存在此浏览器的 LocalStorage；没有账号或云同步。清理浏览器数据会丢失状态，请定期导出备份。导入会合并记录，同 ID 采用导入版本。
    </div>
    {storageError && <p role="alert" className="mb-4 rounded-lg border border-[#f0d7bf] bg-[#fff9f3] p-3 text-xs text-[#9b693c]">{storageError}</p>}
    {feedback && <p role="status" className="mb-4 rounded-lg border border-[#d9e8dc] bg-[#f5fbf6] p-3 text-xs text-[#4e8964]">{feedback}</p>}
    <div role="tablist" aria-label="收藏筛选" className="mb-5 flex gap-2">
      {(["all", "unread", "hidden"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value}
        onClick={() => setTab(value)} className={`focus-ring rounded-lg px-3 py-2 text-xs font-semibold ${tab === value ? "bg-[#eeeafa] text-[#6957c7]" : "text-[#8d92a2] hover:bg-white"}`}>
        {value === "all" ? "全部收藏" : value === "unread" ? "未读" : "已隐藏"}
      </button>)}
    </div>
    {!ready ? <div className="panel p-8 text-center text-xs text-[#687184]" role="status">正在读取本机收藏…</div>
      : filtered.length === 0 ? <EmptyState title="这里还没有匹配的收藏" description="在 Today、Explore 或 GitHub Radar 的仓库卡片中点击“收藏”，即可将条目保存在当前浏览器。" actionHref="/explore" actionLabel="前往探索" />
        : <div className="grid gap-4 xl:grid-cols-2">{filtered.map(([id, entry]) => {
          const item = current.get(id);
          return item ? <IntelligenceCard key={id} item={item} /> : <article key={id} className="panel p-5">
            <div className="mb-3 flex items-center gap-2 text-[#aa8a4c]"><Link2Off size={15} /><span className="text-[11px] font-semibold">当前发布数据中不存在</span></div>
            <h3 className="break-words text-sm font-semibold text-[#414559]">{entry.snapshot.title}</h3>
            <p className="mt-2 break-all text-[11px] text-[#687184]">{id}</p>
            <p className="mt-3 text-[12px] leading-6 text-[#687184]">本地收藏仍保留；该条目可能不在最近一次采样中。旧评分与描述不作为当前事实展示。</p>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-[#f0f1f5] pt-3 text-xs">
              <a href={entry.snapshot.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#6c5cc7] hover:underline">打开原始链接</a>
              <button type="button" onClick={() => toggleExisting(id, "saved")} className="focus-ring font-semibold text-[#687184] hover:text-[#6c5cc7]">取消收藏</button>
            </div>
          </article>;
        })}</div>}
  </>;
}

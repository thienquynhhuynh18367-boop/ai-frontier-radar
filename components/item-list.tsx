"use client";

import { useEffect, useState } from "react";
import type { IntelligenceItem } from "../types/intelligence-item";
import { IntelligenceCard, EmptyState } from "./radar-ui";
import { useSaved } from "./saved-provider";

export function ItemList({ items, pageSize = 12, maxItems, compact = false, showHidden = false, emptyText = "没有符合条件的条目。" }: {
  items: readonly IntelligenceItem[]; pageSize?: number; compact?: boolean;
  maxItems?: number; showHidden?: boolean; emptyText?: string;
}) {
  const { state } = useSaved();
  const [shown, setShown] = useState(pageSize);
  const visible = items.filter((item) => showHidden || !state.entries[item.id]?.hidden).slice(0, maxItems);
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(pageSize), 0);
    return () => window.clearTimeout(timer);
  }, [items, pageSize]);
  if (!visible.length) return <EmptyState title="当前没有可显示的条目" description={emptyText} />;
  return <div>
    <div className={compact ? "space-y-3" : "grid gap-4 xl:grid-cols-2"}>
      {visible.slice(0, shown).map((item) => <IntelligenceCard key={item.id} item={item} compact={compact} />)}
    </div>
    {visible.length > shown && <button type="button" onClick={() => setShown((count) => count + pageSize)}
      className="focus-ring mt-5 w-full rounded-xl border border-[#e4e6ef] bg-white px-4 py-3 text-xs font-semibold text-[#6c5cc6] hover:bg-[#f8f6ff]">
      显示更多（已显示 {Math.min(shown, visible.length)} / {visible.length}）
    </button>}
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { isDataStale } from "../lib/freshness";

export function FreshnessStatus({ asOf, staleAtBuild }: { asOf: string; staleAtBuild: boolean }) {
  const [stale, setStale] = useState(staleAtBuild);
  useEffect(() => {
    const update = () => setStale(isDataStale(asOf, new Date().toISOString()));
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [asOf]);
  if (!stale || staleAtBuild) return null;
  return <p role="status" className="mt-2 text-sm font-medium text-amber-800">
    数据已超过 48 小时未更新；这是上一次有效采集结果。
  </p>;
}

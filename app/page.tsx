import { loadPreview } from "../lib/preview-data";
import { FreshnessStatus } from "./freshness-status";

export default async function Home() {
  // Static Export 在 build 时读取经过验证的 public/data；不依赖运行时 API。
  const preview = await loadPreview(process.cwd(), new Date().toISOString());
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <header className="mb-8 border-b pb-6">
        <p className="text-sm font-semibold tracking-wide text-slate-500">GitHub Search · 数据预览</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">AI Frontier Radar</h1>
        <p className="mt-3 text-slate-600">{preview.message}</p>
        {preview.latest && <FreshnessStatus asOf={preview.latest.asOf} staleAtBuild={preview.stale} />}
        {preview.latest && (
          <p className="mt-3 text-sm text-slate-500">
            最近有效更新：<time dateTime={preview.latest.asOf}>{preview.latest.asOf}</time>
            {" · "}仓库 {preview.latest.itemCount} 个
            {" · "}来源 GitHub Search
          </p>
        )}
      </header>
      {preview.latest && preview.latest.items.length > 0 ? (
        <ol className="space-y-4">
          {preview.latest.items.map((item) => {
            const description = item.metadata.description;
            const stars = item.metadata.stars;
            const forks = item.metadata.forks;
            const parts = item.scoreBreakdown;
            return (
              <li key={item.id} className="rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-700 underline-offset-4 hover:underline">{item.title}</a>
                  </h2>
                  <span className="rounded-lg bg-blue-50 px-3 py-1 font-semibold text-blue-800">
                    Personal Score {item.personalScore.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {typeof description === "string" && description.trim() ? description : "暂无仓库描述"}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span>Stars {typeof stars === "number" ? stars.toLocaleString() : "未知"}</span>
                  <span>Forks {typeof forks === "number" ? forks.toLocaleString() : "未知"}</span>
                  {item.topics.map((topic) => (
                    <span key={topic} className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{topic}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  评分贡献：主题 {parts.topic} · 来源 {parts.source} · 时效 {parts.freshness}
                  {" · "}热度 {parts.popularity} · 新颖度 {parts.novelty}。
                  分数用于当前偏好排序，不代表项目的客观行业价值。
                </p>
              </li>
            );
          })}
        </ol>
      ) : <p className="rounded-xl border border-dashed p-6 text-slate-600">暂无可展示的仓库。</p>}
    </main>
  );
}

import { ArrowUpRight, CircleDashed, Database, ListFilter } from "lucide-react";
import { PageHeader, ScopeNote } from "./page-frame";
import { sitePath } from "../lib/site-path";

const modules = {
  products: { eyebrow: "SOURCE RADAR / PRODUCTS", title: "产品雷达", type: "产品发布与更新",
    description: "追踪可核验的新产品发布、功能更新与产品方向。", fields: "产品名称、官方发布链接、发布日期、更新内容和来源证据" },
  startups: { eyebrow: "SOURCE RADAR / STARTUPS", title: "创业雷达", type: "创业信号",
    description: "观察有公开证据的新公司、团队与产品启动信号。", fields: "公司名称、官方链接、首次公开时间、产品定位和来源证据" },
  funding: { eyebrow: "SOURCE RADAR / FUNDING", title: "融资雷达", type: "融资公告",
    description: "仅记录有原始公告或可靠公开来源可追溯的融资事件。", fields: "公司、融资轮次、公布日期、金额（仅来源明确时）与原始公告链接" },
  research: { eyebrow: "SOURCE RADAR / RESEARCH", title: "研究雷达", type: "论文与研究",
    description: "追踪公开论文和研究成果，优先保留原文链接与可核验元数据。", fields: "标题、作者、摘要、分类、发布时间与论文原文链接" },
  career: { eyebrow: "SOURCE RADAR / CAREER", title: "职业雷达", type: "公开岗位信号",
    description: "观察 AI PM、FDE 与 Applied AI 等公开岗位方向。", fields: "岗位名称、公司、地点、发布时间、职位链接和来源证据" },
} as const;

export type UnconnectedModule = keyof typeof modules;

export function UnconnectedRadar({ module }: { module: UnconnectedModule }) {
  const info = modules[module];
  return <>
    <PageHeader eyebrow={info.eyebrow} title={info.title} description={info.description} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="panel min-h-[330px] p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#eadff0] bg-[#faf7ff] px-3 py-1.5 text-[11px] font-semibold text-[#856fc7]">
          <CircleDashed size={13} /> 数据源尚未接入
        </span>
        <div className="mt-12 max-w-lg"><span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#f3f1fd] text-[#8b7ad7]"><Database size={22} /></span>
          <h2 className="text-xl font-semibold tracking-tight text-[#32364a]">目前没有经过验证的{info.type}数据</h2>
          <p className="mt-3 text-[13px] leading-7 text-[#828798]">对应 Collector 尚未接入。此页面会在来源、标准化、分类、评分和发布校验完成后，使用统一 IntelligenceItem 契约展示真实条目。</p>
          <a href={sitePath("/health")} className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-[#6d5cc8] hover:underline">查看数据源状态 <ArrowUpRight size={13} /></a>
        </div>
      </section>
      <aside className="space-y-4"><section className="panel p-5">
        <div className="mb-3 flex items-center gap-2 text-[#7f72ce]"><ListFilter size={16} /><h2 className="text-sm font-semibold text-[#3e4255]">计划的数据类型</h2></div>
        <p className="text-[13px] leading-6 text-[#777d90]">{info.fields}。</p>
        <p className="mt-4 border-t border-[#f0f1f5] pt-3 text-[11px] leading-5 text-[#687184]">接入后会提供与 Explore 一致的搜索、筛选和收藏操作。</p>
      </section>
      <section className="rounded-xl border border-[#e8e4f8] bg-[#faf9ff] p-5"><p className="eyebrow mb-2">DATA INTEGRITY</p>
        <p className="text-[12px] leading-6 text-[#77718f]">现有 GitHub 仓库不会被当作{info.type}填入此页。缺少来源证据时保持空状态。</p></section></aside>
    </div>
    <div className="mt-5"><ScopeNote>此页面的“未接入”表示尚未建立采集器，不表示来源故障。</ScopeNote></div>
  </>;
}

# AI Frontier Radar 产品需求文档

> 本文依据《AI_Frontier_Radar_PRD_最终版.docx》整理为仓库内的 Markdown 产品文档，并纳入项目所有者在 Task 00 中明确提出的 Funding Radar、Search / Filter 与 Data Source Health。工程细节以 [ARCHITECTURE.md](ARCHITECTURE.md) 为准。工程 Task 是施工顺序，不代表不同产品版本。

## 1. 产品定位与最终边界

AI Frontier Radar 是面向本人长期使用的 AI 行业前沿信息雷达 Web 产品。它每天从公开来源采集 AI 技术、Agent、RAG、MCP、AI Coding、产品、创业公司、融资、开源项目、论文、重点公司和职业市场信息，将大量重复信息压缩为值得关注的内容，并利用历史数据展示可核验的变化。

产品价值是**筛选、发现、趋势、沉淀**。使用者应能在约 15–30 分钟内完成每天的前沿输入。网站公开可访问，但当前只为一位使用者设计偏好；用户主动访问 Web，不设通知渠道、登录或云端个人数据同步。

### 当前必须交付的产品能力

| 能力 | 要回答的问题 |
| --- | --- |
| Today | 今天最值得关注的 5–10 条是什么？ |
| Explore 与 Search / Filter（搜索与筛选） | 还有哪些条目？如何按类型、主题、来源、时间与分数查找？ |
| Topics | Agent、RAG、MCP、AI Coding 等主题近期如何变化？ |
| GitHub Radar | 哪些 AI 仓库、更新和 Release 值得关注？ |
| Products Radar | 哪些 AI 产品出现了可追溯的新发布或更新？ |
| Startup Radar | 哪些新公司或创业信号值得关注？ |
| Funding Radar | 哪些公司公开宣布融资，原始证据是什么？ |
| Research Radar | 最近哪些论文值得快速浏览？ |
| Career Radar | AI PM、FDE、Applied AI 等公开岗位出现了什么信号？ |
| Trends | 7 / 30 / 90 天的主题数量、增速和来源构成如何变化？ |
| Saved | 如何保存、标记已读、隐藏和导出个人条目？ |
| Data Source Health | 来源与每日任务何时成功、何处失败、数据是否过期？ |

条目详情展示结构化字段、来源、时间、可解释分数和原文跳转，不镜像整篇原文。首页只放最高价值信息；缺少证据的模块不占据固定版面。

### 当前明确排除

- LLM / OpenAI / Anthropic / Gemini 等模型 API、RAG、Embedding、Vector Database、AI Chat、Ask AI、Agent、Skill、Coze、飞书。
- 用户注册、登录、多用户、权限、云同步、付费数据库与任何可能产生项目运营费用的服务。
- 桌面端、移动 App、浏览器插件和自动通知入口。
- 自动下载论文 PDF、镜像文章全文、自动生成主观行业观点。

未来若要增加上述能力，须由项目所有者明确改变范围；当前验收不依赖它们。

## 2. 使用者与真实需求

使用者关注 AI 产品经理、FDE、AI 应用与 Enterprise AI。高优先主题包括 Agent、RAG、MCP、AI Coding、AI Product、AI Startup、融资与 FDE；中优先主题包括 Multimodal、AI Search、AI Infra 与 Research；弱化纯模型训练、重复 Benchmark 和与应用价值关联很低的内容。重点关注 OpenAI、Anthropic、Google、DeepSeek、字节和阿里等公司。

核心问题是信息过多、重复严重、质量差异大、与个人目标相关程度不同，而且单日新闻难以构成长期趋势判断。日常场景包括早晨快速扫读、按 Topic 追踪方向、研究 GitHub 项目、查看产品及创业信号、观察岗位变化，并保存有长期价值的条目。

## 3. 产品原则与成功标准

1. **筛选优先：**Today 帮助决定今天看什么，不把全部来源平铺成新闻瀑布流。
2. **确定性优先：**分类、去重、评分与趋势先由规则和统计完成，并能独立测试。
3. **原始来源优先：**每条内容保留来源、时间和原链接；没有证据的结论不展示为事实。
4. **长期可运行：**单一来源失败不使全站不可用；任务可重跑、可补跑、不重复污染数据。
5. **零现金成本：**Monthly Cash Operating Cost = ¥0；不以购买 API、域名、服务器或数据库来维持核心功能。

成功状态包括每日自动更新、首页多数推荐条目确有阅读价值、7 / 30 / 90 天趋势可从历史数据重算、来源失败可被发现和恢复，以及公开仓库、在线 Web、PRD、架构、开发记录可用于作品集展示。

## 4. 信息源与采集原则

接入优先级为 **Official API（官方接口） > RSS / Atom（订阅源） > Sitemap（站点地图） > HTML Scraping（网页解析）**。HTML 只在缺少稳定接口且产品确有需要时使用；Collector（数据采集器）按来源隔离。已确定和待确认的来源见 [DATA-SOURCES.md](DATA-SOURCES.md)。

- **GitHub：**GitHub API 与 GitHub Trending。关注 llm、ai-agent、agent、rag、mcp、ai-coding、vector-database、large-language-model、machine-learning；保存仓库名、描述、URL、Stars、Forks、Topics、创建与更新时间以及可获得的 Release。
- **Hacker News：**优先使用 Algolia Hacker News API；关注 AI、LLM、Agent、OpenAI、Anthropic、Claude、MCP、RAG、machine learning；至少保存标题、URL、Points、Comments 和发布时间。
- **arXiv：**关注 cs.AI、cs.CL、cs.LG 与 Agent、RAG、Retrieval、Memory、Tool Use、Reasoning、Multimodal；保存标题、作者、摘要、分类、时间与原文链接，不下载 PDF。
- **OpenAI / Anthropic：**优先使用 RSS、Sitemap 和可验证的更新时间做增量发现，只处理新 URL 或确实更新的 URL。
- **Hugging Face：**PRD 列为可选公开 Hub API 来源，限于免费公开元数据，接入前核对限流和价值。
- **Product / Startup / Funding / Career：**只从可追溯的公开来源记录结构化信号；优先官方 API、RSS 和公开岗位接口。具体来源须先核实免费条件和稳定性，不为凑数量接入大量脆弱页面。

每个 Collector 只产生 Raw Data（原始数据），记录抓取时间、来源、来源 ID、URL 与错误。Raw Data 不直接交给前端；单个 Collector 失败不阻止其他来源运行。

## 5. 数据链路与统一条目

```text
External Sources（外部来源）
  → Collector（采集器）
  → Raw Data（原始数据）
  → Normalize（标准化）
  → Deduplicate（去重）
  → Filter / Classification（过滤与规则分类）
  → Popularity Ranking（热度排序）
  → Personal Ranking（个人相关度排序）
  → Trend Statistics（趋势统计）
  → Data Validation（数据验证）
  → Structured JSON（结构化数据）
  → Next.js Web（网站展示）
```

所有来源最终映射为统一的 `IntelligenceItem`。条目至少包含稳定 ID、标题、规范 URL、来源及采集方式、内容类型、发布时间（可缺失）、采集与首次发现时间、主题、公司、Popularity Score（热度分）、Personal Score（个人相关度分）和来源特定元数据。内容类型覆盖 news、repository、paper、product、startup、funding、job、company_update。完整 Schema（数据结构规范）见架构文档。

Deduplicate（去重）采用来源稳定 ID、规范 URL、规范标题及 Hash（哈希指纹）的确定性组合。去掉追踪参数、统一大小写与空格；同一任务重跑必须得到相同条目集合。前端不承担核心清洗、去重、分类或评分。

## 6. Personal Ranking（个人相关度排序）

所有权重集中配置，并保存分项结果供界面解释。PRD 建议权重如下：

| 维度 | 权重 | 含义 |
| --- | ---: | --- |
| Topic Match（主题匹配） | 35% | 高、中、低优先级主题匹配 |
| Source Quality（来源质量） | 20% | 官方来源、可信社区和一般来源分级 |
| Freshness（时效） | 20% | 相对固定计算时点的时间衰减 |
| Popularity（热度） | 15% | 同类来源指标归一化 |
| Novelty（新颖度） | 10% | 近期重复内容及实体的反向信号 |

分数必须能回答“为什么这条是 91 分”。收藏、已读和隐藏保存在 LocalStorage（浏览器本地存储）；当前不以行为训练模型，也不把核心 Ranking（排序逻辑）放到浏览器。

## 7. Trend Engine（趋势统计引擎）

只计算可复核的事实，不生成 AI 行业观点。窗口为 7、30、90 天，并与各自前一个等长窗口比较。例如：最近 7 天 MCP 42 条、前 7 天 28 条，Growth Rate（增长率）为 `(42 - 28) / 28 = +50%`。

统计项包括 Topic Mention Count（主题条目数）、GitHub Repo Count（仓库数）、GitHub Star Growth（Star 增量）、Hacker News Discussions（讨论数）、Paper Count（论文数）、Product Count（产品数）、Startup Count（创业信号数）、Funding Count（融资信号数）及 Job Signal Count（岗位信号数）。可依据数量、增长和来源多样性标记 Rising、Stable、Emerging、Cooling、Noise；证据不足时显示数据不足。Trends 页面展示图表、增长率、来源分布和相关条目。

## 8. 核心页面与交互

- **Today：**扫描量、过滤后数量、最后更新；“必须知道”5–10 条、今日升温、重点仓库，以及有数据才展示的公司、产品与岗位信号。
- **Explore / Search / Filter：**按内容类型、主题、来源、时间与分数筛选和排序；保持快速扫读。
- **Topics 与各 Radar：**提供所关注领域的近期条目、来源和可核验指标。Funding 仅呈现有公开原始证据的融资信号。
- **Detail：**显示统一条目和来源元数据，跳转原文，不复制全文。
- **Trends：**展示 7 / 30 / 90 天统计及支持数据。
- **Saved：**收藏、已读、隐藏与 JSON 导出；浏览器数据丢失时可依靠导出备份。
- **Data Source Health：**展示各来源最近成功时间、抓取量、错误及 Pipeline 状态，明确数据是否过期。

## 9. 存储、调度与稳定性

当前优先使用 GitHub Public Repository 内的历史 JSON、`latest.json`、`manifest.json`、`trends.json` 和 `sources-status.json`，不引入数据库。按日期保存历史，不只覆盖 `latest.json`。Raw Data 只保留重算需要的最小字段、来源 ID 和 URL，不保存没有必要的网页全文。**Raw Data 不进入网站静态发布产物；存于公开 GitHub 仓库的 Raw Data 本身仍是公开数据。**

GitHub Actions（自动化工作流）每日执行采集、处理、趋势、验证、保存、提交和部署，并支持 `workflow_dispatch` 手动运行。稳定性要求：

- Retry（失败重试）与 Timeout（请求超时）有上限，避免无限等待。
- Graceful Degradation（优雅降级）：单一来源失败时其余来源继续。
- Health Check（健康检查）记录 `lastSuccessAt`、`fetchedCount`、`status`、`lastError`、`consecutiveFailures`。
- Schema Validation（结构验证）和 Data Anomaly（数据异常）阻止坏数据更新 `latest.json`；例如昨天 430 条、今天突然 0 条时不能正常发布。
- Backfill（历史补跑）支持手动指定日期，但不得伪造无法重建的历史来源状态。
- Idempotency（幂等性）保证同一输入重复运行不产生重复记录。

## 10. 成本、风险与验收

主技术栈为 Next.js、TypeScript、Tailwind CSS、shadcn/ui、GitHub Actions、JSON Data（JSON 数据）和 LocalStorage（浏览器本地存储），优先使用 GitHub Pages 等免费静态部署方案与平台默认域名。任何新增依赖先核对收费、信用卡、自动超额计费、免费额度及可替换性；有收费风险时暂停该依赖的实施并说明。

关注 Daily Useful Rate（首页有用率）、Compression Ratio（信息压缩率）、Duplicate Reduction（去重效果）、Source Health（来源健康度）、Pipeline Success（每日任务成功率）和 Reading Time（阅读时间）。

最终验收至少包括公开 Web URL、每日自动更新、GitHub / HN / arXiv / 官方博客四类核心源、全部来源统一 Schema、可独立测试的去重分类排序、完整约定页面、7 / 30 / 90 天趋势、LocalStorage 状态与导出、单源失败时仍可更新、仓库文档与测试，以及月现金运营成本 ¥0。

长期风险包括 HTML 结构变化、GitHub Rate Limit（频率限制）、规则误判、仓库数据增长、免费政策变化和 Vibe Coding（协作开发）失控。优先 API / RSS、集中规则、监控健康状态、控制数据体积、按 Task 验证并保留可回滚 Commit。

## 11. 工程协作与交付

每个 Task 遵循 Read → Analyze → Plan → Files → Implement → Test → Lint → Typecheck → Build → Diff → Report → Commit。Bug 先 Reproduce（复现）、查看日志、定位层级、做 Root Cause Analysis（根因分析），再提出最小修复与 Regression Test（回归测试）。禁止无关重构和连续无验证修改。

最终交付物包括公开 GitHub Repository、在线 Web、正式 Word PRD 与本 Markdown PRD、架构文档、AGENTS.md、每日自动化任务、README、测试与部署说明，以及数周真实运行数据和使用复盘。模型、RAG、Agent、Skill、通知与账号系统仅属未来可能扩展，当前不实施。

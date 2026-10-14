# AI Frontier Radar Data Source Registry（数据源注册表）

> 本表只登记正式 PRD 或阶段任务明确确认、且已经核验访问方式的公开来源。数值限制和使用条件可能变化，接入前须再次核对。`当前状态` 区分已实现的 Collector（采集器）与尚未完成的 Pipeline（处理流水线）和每日自动运行。

## 接入顺序与登记标准

采用 **Official API（官方接口） > RSS / Atom（订阅源） > Sitemap（站点地图） > HTML Scraping（网页解析）**。新的数据源只有在能确认原始出处、访问方式、免费条件和维护价值后才加入本表。有收费、信用卡或自动超额收费风险时，不接入，先向项目所有者说明。

| 来源名称 | 数据类型 | 接入方式 | 是否官方 | 是否免费 | Token | Rate Limit（频率限制） | 稳定性 | Fallback（降级机制） | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [GitHub REST API](https://docs.github.com/en/rest/search/search) | Repository（仓库）、Topics、Stars、Forks、更新；Release 尚未接入 | 官方 REST API（接口）；Repository Search | 是 | 公开数据可免费读取；无需信用卡 | Collector 可匿名运行，也可接收外部传入 Token；后续 Action 才接 `GITHUB_TOKEN` | Search 有独立限制，运行时以响应头为准。([限流文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)) | 高；搜索结果仍受额度、分页和索引影响 | 限流或数据异常时沿用该来源旧条目并标明最后成功时间 | Repository Search 全链路已实现；UTC 时间戳限定与本地精确过滤，仍是一页采样；Trending、Release、每日 Actions 未实现 |
| [GitHub Trending](https://github.com/trending) | 当日 Trending Repository（热门仓库） | 官方网站 HTML；没有承诺稳定的公开 Trending API | 网站是 GitHub 官方；解析接口不是官方 API | 公开网页可访问，接入前复核抓取条件 | 不需要 | 无公开固定额度；低频、礼貌请求 | 中低；HTML 结构可能变化 | 独立失败并显示缺失；GitHub Search 仍可工作，但不得冒充 Trending | PRD 已确认；未接入 |
| [Hacker News Search by Algolia](https://hn.algolia.com/api) | AI / LLM / Agent 等 Story（帖子），Points、Comments、发布时间 | Algolia HN Search API（搜索接口） | Algolia 提供的 HN 搜索服务；不是 Hacker News Firebase 官方 API | 公开搜索接口可访问；无需付费计划或信用卡 | 公开查询不需要 | 官方 API 页面写明单 IP 10,000 请求/小时；本项目默认每词 1 页、共 8 次 | 中高；受第三方索引可用性影响 | 失败时保留上次有效 HN 条目并标记时间 | Collector、Normalizer、Pipeline 与 Web 已接入；按窗口精确过滤，仍是关键词采样 |
| [arXiv API](https://info.arxiv.org/help/api/user-manual.html) / RSS | cs.AI、cs.CL、cs.LG 论文元数据与摘要 | 官方 Atom API | 是 | 公开元数据免费；无需信用卡 | 不需要 | [官方条款](https://info.arxiv.org/help/api/tou.html) 要求旧 API 最多每 3 秒 1 请求且单连接；当前每轮仅 1 请求 | 高；发布时间和索引更新存在节奏 | 失败保留上次有效论文；不下载 PDF | Collector、Normalizer、Pipeline 与 Web 已接入；仅取按提交时间排序的前 100 条，非全量论文 |
| [OpenAI 官方站](https://openai.com/sitemap.xml) | 官方公司、产品、研究页面更新候选 | 官方 Sitemap 固定栏目 | 是 | 公开 Sitemap 免费；无需信用卡 | 不需要 | 未见统一公开固定额度；每轮至多 5 个栏目请求 | 中；Sitemap 结构和 lastmod 语义可能变化 | 失败保留上次有效条目；未验证标题/发布日期保持缺失证据 | 已接入官方 Sitemap；lastmod 仅作更新提示，标题由 URL slug 显示并显式标记，不能证明当天发布 |
| [Anthropic 官方站](https://www.anthropic.com/sitemap.xml) | 官方新闻、研究、工程页面更新候选 | 官方 Sitemap | 是 | 公开 Sitemap 免费；无需信用卡 | 不需要 | 未见统一公开固定额度；每轮 1 请求 | 中；Sitemap 结构和 lastmod 语义可能变化 | 失败保留上次有效条目；不伪造发布日期 | 已接入官方 Sitemap；只接受 news/research/engineering 路径和窗口内 lastmod |
| [Anthropic 公开奖聘板](https://www.anthropic.com/careers/jobs) / [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) | AI PM、FDE、Applied AI 公开岗位更新信号 | Anthropic 官网直接链接的 Greenhouse 板；公开 GET `/v1/boards/anthropic/jobs` | 招聘板由 Anthropic 作为官方岗位入口使用；API 由 Greenhouse 提供 | 公开 GET 免费；无需信用卡 | 不需要；[Greenhouse 文档](https://docs.greenhouse.io/job-board.html) 明示 GET 无需认证 | 未见固定公开额度；本项目每轮 1 请求 | 中高；依赖 Anthropic 继续使用该招聘板 | 失败保留上次有效岗位，标明最后成功时间 | 已接入；按稳定岗位 ID、职位标题与 `updated_at` 筛选，`publishedAt=null`；不抓岗位正文，也不把更新当新发布 |
| [Hugging Face Hub API](https://huggingface.co/docs/hub/api) | 公开模型 / 项目元数据与热度信号 | 官方 Hub API（接口），只读公开元数据 | 是 | 有公开免费访问层；不使用付费推理或升级额度 | 公开读取可匿名；免费账号 Token 可提高额度，当前不作为必需条件 | 官方文档目前列匿名 API 500 次/5 分钟、免费账号 1,000 次/5 分钟，且注明免费层额度可变。([限流文档](https://huggingface.co/docs/hub/rate-limits)) | 中高；受免费层配额变化影响 | 429 时遵守响应头；停止该来源，保留最近成功数据 | PRD 已列为目标；未决定接入顺序、未接入 |

## 数据质量与公开边界

- `lastmod` 是 Sitemap（站点地图）的修改提示，不自动等于 `publishedAt`。发布日期无法核实时保持缺失。
- GitHub Trending 的 HTML 解析与 GitHub API 分开记录健康状态；一个失败不影响另一个。
- HN 相同原文 URL 与官方来源可能合并为同一 IntelligenceItem（统一情报条目），但必须保留 HN Discussion（讨论）链接作为来源证据。
- arXiv 只保存标题、作者、摘要、分类、时间和原文链接；不自动下载论文 PDF。
- 所有来源仅保存实现产品所需的最小元数据。Public GitHub Repository（公开 GitHub 仓库）中的 `data/raw/` 仍是公开数据；Raw Data（原始数据）不进入网站静态发布产物。

## 尚未登记具体来源的产品范围

Products Radar 已有 HN Show HN 与官方页面更新候选，Career Radar 已有 Anthropic 公开奖聘板；两者都只覆盖目前已验证的来源。Startup Radar 与 Funding Radar **仍属于已确定产品范围**，但正式 PRD 没有指定足够稳定、免费的具体创业或融资数据源。后续应先核实来源身份、公开事件证据、免费条件、Token、Rate Limit、使用条款及 Fallback，再更新注册表并实现 Collector。不得将普通新闻或官方 Sitemap 的 `startup` 栏目直接推断为融资，也不得为了填满页面虚构创业公司或岗位事实。

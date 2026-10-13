# AI Frontier Radar Data Source Registry（数据源注册表）

> 本表只登记正式 PRD 明确点名的公开来源。数值限制和使用条件可能变化，接入前须再次核对。`当前状态` 区分已实现的 Collector（采集器）与尚未完成的 Pipeline（处理流水线）和每日自动运行。

## 接入顺序与登记标准

采用 **Official API（官方接口） > RSS / Atom（订阅源） > Sitemap（站点地图） > HTML Scraping（网页解析）**。新的数据源只有在能确认原始出处、访问方式、免费条件和维护价值后才加入本表。有收费、信用卡或自动超额收费风险时，不接入，先向项目所有者说明。

| 来源名称 | 数据类型 | 接入方式 | 是否官方 | 是否免费 | Token | Rate Limit（频率限制） | 稳定性 | Fallback（降级机制） | 当前状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [GitHub REST API](https://docs.github.com/en/rest/search/search) | Repository（仓库）、Topics、Stars、Forks、更新与选定仓库的 Release | 官方 REST API（接口）；Repository Search + 必要的仓库查询 | 是 | 公开数据可免费读取；使用公开仓库标准 Actions Runner | Collector 可匿名运行，也可接收外部传入 Token；后续 Action 才接 `GITHUB_TOKEN` | `GITHUB_TOKEN` 常规 REST 主额度为每仓库 1,000 请求/小时；Search 有独立限制，运行时以响应头为准。([限流文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)) | 高；搜索结果仍受额度、分页和索引影响 | 限流或数据异常时保留最近有效 latest，并发布来源状态 | Repository Search Collector、Normalizer、Pipeline、完整静态 Web 页面和安全逐查询诊断已实现；Trending、Release、每日 GitHub Actions 未实现，长期趋势仍需足够历史 |
| [GitHub Trending](https://github.com/trending) | 当日 Trending Repository（热门仓库） | 官方网站 HTML；没有承诺稳定的公开 Trending API | 网站是 GitHub 官方；解析接口不是官方 API | 公开网页可访问，接入前复核抓取条件 | 不需要 | 无公开固定额度；低频、礼貌请求 | 中低；HTML 结构可能变化 | 独立失败并显示缺失；GitHub Search 仍可工作，但不得冒充 Trending | PRD 已确认；未接入 |
| [Hacker News Search by Algolia](https://hn.algolia.com/api) | AI / LLM / Agent 等 Story（帖子），Points、Comments、发布时间 | Algolia HN Search API（搜索接口） | Algolia 提供的 HN 搜索服务；不是 Hacker News Firebase 官方 API | 公开搜索接口可访问；长期条件接入前复核 | 公开查询不需要 | 文档未承诺固定免费额度；控制关键词、分页和请求量 | 中高；受第三方索引可用性影响 | 标记 HN 来源失败；不将零结果直接解释为没有新闻 | PRD 已确认；未接入 |
| [arXiv API](https://info.arxiv.org/help/api/user-manual.html) / RSS | cs.AI、cs.CL、cs.LG 论文元数据与摘要 | 官方 Atom API 或 RSS | 是 | 公开元数据免费 | 不需要 | 连续请求建议至少间隔 3 秒。([arXiv 官方手册](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/api/user-manual.md)) | 高；发布时间和索引更新存在节奏 | API 不可用时使用适当 RSS；只保存元数据，不下载 PDF | PRD 已确认；未接入 |
| [OpenAI 官方站](https://openai.com/) | 官方公司、产品、研究更新 | 优先官方 RSS；若无合适 RSS，使用官方 Sitemap 增量发现 | 是 | 公开发布页免费 | 不需要 | 未见统一公开固定额度；低频访问并尊重站点响应 | 中；Sitemap 结构和页面访问策略可能变化 | 页面不可读取时仅保留有证据的 URL / 元数据，并标记缺失字段；不伪造发布日期 | PRD 已确认；具体入口待接入前核对 |
| [Anthropic 官方站](https://www.anthropic.com/) | 官方公司、产品、研究更新 | 优先官方 RSS；若无合适 RSS，使用官方 Sitemap 增量发现 | 是 | 公开发布页免费 | 不需要 | 未见统一公开固定额度；低频访问并尊重站点响应 | 中；栏目与 Sitemap 结构可能变化 | 只保留可核实的 URL / 元数据，来源异常在 Health 中显示 | PRD 已确认；具体入口待接入前核对 |
| [Hugging Face Hub API](https://huggingface.co/docs/hub/api) | 公开模型 / 项目元数据与热度信号 | 官方 Hub API（接口），只读公开元数据 | 是 | 有公开免费访问层；不使用付费推理或升级额度 | 公开读取可匿名；免费账号 Token 可提高额度，当前不作为必需条件 | 官方文档目前列匿名 API 500 次/5 分钟、免费账号 1,000 次/5 分钟，且注明免费层额度可变。([限流文档](https://huggingface.co/docs/hub/rate-limits)) | 中高；受免费层配额变化影响 | 429 时遵守响应头；停止该来源，保留最近成功数据 | PRD 已列为目标；未决定接入顺序、未接入 |

## 数据质量与公开边界

- `lastmod` 是 Sitemap（站点地图）的修改提示，不自动等于 `publishedAt`。发布日期无法核实时保持缺失。
- GitHub Trending 的 HTML 解析与 GitHub API 分开记录健康状态；一个失败不影响另一个。
- HN 相同原文 URL 与官方来源可能合并为同一 IntelligenceItem（统一情报条目），但必须保留 HN Discussion（讨论）链接作为来源证据。
- arXiv 只保存标题、作者、摘要、分类、时间和原文链接；不自动下载论文 PDF。
- 所有来源仅保存实现产品所需的最小元数据。Public GitHub Repository（公开 GitHub 仓库）中的 `data/raw/` 仍是公开数据；Raw Data（原始数据）不进入网站静态发布产物。

## 尚未登记具体来源的产品范围

Products Radar、Startup Radar、Funding Radar 与 Career Radar **仍属于已确定产品范围**，但正式 PRD 没有指定足够稳定、免费的具体产品、创业、融资或岗位数据源。后续对应 Task 应先核实来源身份、公开证据、免费条件、Token、Rate Limit、使用条款及 Fallback，然后再更新本注册表并实现 Collector。不得将未经确认的候选来源写成已接入，也不得为了填满页面推断融资或岗位事实。

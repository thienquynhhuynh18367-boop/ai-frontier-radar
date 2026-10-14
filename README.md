# AI Frontier Radar

AI Frontier Radar 是供本人长期使用的 AI 行业前沿信息雷达 Web 产品，目标是从公开信息中筛出值得关注的内容，并用历史数据展示可核验的趋势。

## 核心价值

围绕 AI 技术、Agent、RAG、MCP、AI Coding、产品、创业公司、融资、开源项目、论文和职业市场，建立“采集 → 标准化 → 去重 → 分类 → 排序 → 趋势统计 → Web 展示”的确定性数据链路，让每天的前沿输入更聚焦、可追溯、可沉淀。

## 当前技术架构

Next.js 16 Static Export（静态导出）提供 Today、Explore、Topics、GitHub Radar、Products、Research、Career、Trends、Saved、Data Source Health 和 Detail；Startup 与 Funding 在缺少可信数据时保持明确空状态。Node.js CLI 使用 FetchHttpClient 与 GitHub Search、HN Algolia、arXiv Atom、OpenAI/Anthropic 官方 Sitemap 及 Anthropic 官网链接的 Greenhouse 招聘板采集公开元数据，经 Normalize、Deduplicate、Classification、Ranking 与发布校验生成历史 JSON。网站构建时读取已验证的 `public/data/`；搜索筛选和收藏交互在浏览器，核心清洗与评分不在前端。趋势只用真实连续历史、相同来源覆盖计算；没有每日 GitHub Actions。

## 当前目录

```text
ai-frontier-radar/
├─ app/                    # 全部约定静态路由和页面
├─ collectors/             # GitHub、HN、arXiv、官方 Sitemap 独立 Collector
├─ config/sources/         # 数据源查询与请求规模配置
├─ components/             # 导航、条目、筛选、状态和本地收藏交互
├─ lib/                    # HTTP Client、发布读取、筛选与趋势统计
├─ pipeline/               # Normalize、Deduplicate、Classification、Ranking 与发布门槛
├─ scripts/radar.ts        # 实际采集 CLI
├─ data/                   # 原始快照、每日历史、latest 与状态；公开仓库中也公开
├─ public/data/            # 已验证的网站发布 JSON；不含 RawItem
├─ types/                  # RawItem、NormalizedItem 等运行时契约
├─ tests/                  # 离线契约、Pipeline 与 Web 数据测试
├─ docs/                   # PRD、架构、数据源与开发规范
├─ AGENTS.md               # Codex 工程约束
├─ README.md               # 项目入口
├─ components.json         # shadcn/ui 配置
├─ next.config.ts          # Static Export 配置
├─ eslint.config.mjs       # ESLint 配置
├─ postcss.config.mjs      # Tailwind CSS 构建配置
├─ tsconfig.json           # TypeScript 严格模式配置
├─ package.json            # npm 脚本和依赖
└─ package-lock.json       # npm 锁定版本
```

长期趋势算法已具备，但需要累计 14 / 60 / 180 个来源覆盖一致的真实业务日；每日自动化工作流和静态部署留待后续 Task。

## 本地开发入口

Windows PowerShell 本地步骤。先安装 Node.js 24，在 PowerShell 中进入克隆后的仓库目录，然后执行：

```powershell
cd C:\路径\ai-frontier-radar
npm ci
npm run radar:smoke
npm run radar:run
npm run dev
```

`radar:smoke` 对 GitHub/HN 使用小范围查询，对 arXiv、官方 Sitemap 和岗位板使用受控请求，默认不发布。`radar:run` 使用正式配置，默认采集**最近一个已完成的上海自然日**；完成后访问 <http://localhost:3000>。无需 PAT；如已有合适的 GitHub Token，可临时通过 PowerShell 环境变量 `GITHUB_TOKEN` 传给 CLI，不要写入文件。匿名 Search 有独立限流；单源失败时沿用该源旧数据并标明最后成功时间，全源无新数据时保留旧 `latest.json`。

要检查每组 Query 的候选、时间窗外数量与重叠数，可在额度允许时运行 `npm run radar:diagnose -- --date 2026-10-12`。该命令不发布数据，诊断结论见 [DATA-QUALITY.md](docs/DATA-QUALITY.md)。不要为提高数量反复触发免费 Search API。

指定已完成的日期和固定计算时点：

```powershell
npm run radar:run -- --date 2026-10-12 --as-of 2026-10-13T09:00:00.000Z
```

`--date` 按 Asia/Shanghai 解释；`--as-of` 必须是毫秒精度 UTC，且晚于该日结束。同样的源数据与 asOf 可重算；API 返回的实时观测可能随时间变化。运行后如需静态文件，执行：

如本机访问公开 API 必须经过 HTTP 代理，可在当前 PowerShell 会话临时设置 `HTTPS_PROXY`、`HTTP_PROXY` 和 Node 24 的 `NODE_USE_ENV_PROXY=1`；具体代理地址由本机网络环境决定，不写入仓库。

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
```

`npm run build` 将当前已发布 JSON 编入 `out/`，所以每次采集后要重新构建才能更新静态 HTML；首次克隆、尚无 JSON 时全部页面也能构建。Today、Explore、Topics、GitHub Radar、Products、Research、Career 与 Detail 读取真实条目；Trends 在历史不足或来源覆盖不一致时显示原因；Startup、Funding 缺可信来源时保持空状态。收藏、已读和隐藏只保存在当前浏览器的 LocalStorage，可在 Saved 页面导出/导入 JSON；清除浏览器数据前应自行备份。

未来若部署到 GitHub Pages 仓库子路径，可在构建前设置 `$env:RADAR_BASE_PATH='/ai-frontier-radar'`。静态路由使用尾斜杠，固定 `/detail/?id=...` 路由可直接刷新；本 Task 不部署。详细规范见 [DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 文档入口

- [PRD.md](docs/PRD.md)：最终产品范围、来源原则、页面与验收。
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)：系统架构、Data Flow（数据流）、Schema（数据结构规范）、稳定性设计。
- [DATA-SOURCES.md](docs/DATA-SOURCES.md)：Data Source Registry（数据源注册表）及接入状态。
- [DATA-QUALITY.md](docs/DATA-QUALITY.md)：GitHub Search 样本偏斜、受控诊断和发布门槛审查。
- [DEVELOPMENT.md](docs/DEVELOPMENT.md)：开发、测试、Git、Bug 与 Task 规则。
- [AGENTS.md](AGENTS.md)：Codex 工程硬约束。

## Zero Cost Constraint（零现金成本约束）

**Monthly Cash Operating Cost = ¥0。**当前不接付费 API、模型、数据库或收费部署；新增依赖前核查收费、信用卡、自动超额计费和免费额度。公开 GitHub 仓库中的文件默认公开，Raw Data（原始数据）只保存必要字段，且不进入网站静态发布产物。
